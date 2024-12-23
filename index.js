const express = require("express");
const path = require("path");
const port = 3000;
const app = express();
const { Sequelize, Model, DataTypes } = require('sequelize');
const session = require('express-session');
const { futimes } = require("fs");

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'view')); 

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
    session({
        secret: 'secret-key',
        resave: false,
        saveUninitialized: false,
    })
);
const sequelize = new Sequelize('tea', 'postgres', '1111', {
    host: 'localhost',
    dialect: 'postgres',
});

const Connection = async () => {
    try {
        await sequelize.authenticate();
        console.log('Соединение с базой данных успешно установлено.');
    } catch (error) {
        console.error('Не удалось подключиться к базе данных:', error);
    }
};
Connection();
class Role extends Model {}
Role.init({
    role_id: {
        type: DataTypes. INTEGER, 
        autoIncrement: true,
        primaryKey: true,
    },
    role: {
    type: DataTypes. STRING, 
    allowNull: false, 
    unique: true,
    }
},{
    sequelize,
    modelName: 'Role',
    tableName: 'role',
    timestamps: false,
});

class Users extends Model {}
Users.init({
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    role_id: {
        type: DataTypes. INTEGER,
        references:{
            model: Role, 
            key: 'role_id'
        },
            allowNull: false,
        },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    first_name:{
        type: DataTypes.STRING,
    },
    last_name:{
        type: DataTypes.STRING,
    },
    phone:{
        type: DataTypes.STRING,
    }
}, {
    sequelize,
    modelName: 'Users',
    tableName: 'users',
    timestamps: false,
});

Role.hasMany(Users, { foreignKey: 'role_id' }); 
Users.belongsTo(Role, { foreignKey: 'role_id' });

sequelize.sync()
    .then(() => {
        console.log('База данных и таблицы созданы!');
    })
    .catch(error => {
        console.error('Ошибка при синхронизации:', error);
    });



function isAuthenticated(req, res, next){
    // если есть сессия, то продолажает
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

function hasRole(roleName){
    return async (req, res, next) => {
        if (req.session.user) {
            //проверяет совпадение роли с нужной
            const user = await Users.findByPk(req.session.user.id, { include: Role });
            
            if (user && user.Role.role === roleName) {
                next();
            } else {
                console.log('User  ID from session:', req.session.user.id);
                console.log('Fetched user:', user);
                res.status(403).send('Доступ запрещен');
                
            }
        } else {
            res.redirect('/login');
        }
    };
}

app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/profile');
    } else{
        res.redirect('/login')
    }
});
// запрос регистрации, открывает страницу регистрации
app.get('/register', async (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});
// запрос авторизации, сначала проверяется есть ли сессия у пользователя(авторизировался ли он уже), потом открывается окно авторизации
app.get('/login', async (req, res) => {
    if (req.session.user) {
        return res.redirect('/profile');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
// находит id пользователя авторизированного, далее ищет в базе данных пользователя с таким id и открывает личный кабинет с его данными из бд
app.get('/profile', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    const user = await Users.findOne({ where: { user_id: userId }, include: Role });
    res.render('lk', { user });
});

// открывает страницу админа если есть роль админ
app.get('/admin', isAuthenticated, hasRole('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
// уничтожает сессию и отправляет на авторизацию
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

app.post('/register', async (req, res) => {
    // получается данные из формы
    const { email, password, first_name, last_name, phone } = req.body;
    const role_id  = 2;
    // проверка, что у номера телефона меньше 11 цифр
    if (phone.length > 11) {
        return res.status(400).send('<script>alert("Номер телефона не должен превышать 11 символов."); window.location.href = "/register";</script>');
    };
    try {
        // получает почту пользователя и проверяет есть ли в бд уже такая
        const existingUser  = await Users.findOne({ where: { email } });
        if (existingUser ) {
            return res.status(400).send('<script>alert("Пользователь с таким email уже зарегистрирован."); window.location.href = "/register";</script>');
        }
        // создает пользователя
        const user = await Users.create({ email, password, role_id, first_name, last_name, phone});
        res.redirect('/login');
    } catch (error) {
        res.status(400).send('Ошибка регистрации' + error.message);
    }
});

app.post('/login', async (req, res) => {
    // получает данные из формы
    const { email, password } = req.body;
    try {
        // находит пользователя по почте и паролю
        const user = await Users.findOne({ where: { email, password }, include:Role });
        if (user) {
            // созздается сессия
            req.session.user = { id: user.user_id, login: user.email, role: user.Role.role };
            res.redirect('/profile');
        } else {
        res.status(401).send('<script>alert("Неверный логин или пароль."); window.location.href = "/login";</script>');
        }
    } catch (error) {   
        res.status(500).send('Ошибка сервера' + error.message);
    }
});


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});


