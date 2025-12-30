import bcrypt from 'bcrypt';

const password = 'socketIOAdm1n321!';
const saltRounds = 10;

bcrypt.hash(password, saltRounds).then(hash => {
    console.log('Password:', password);
    console.log('Bcrypt Hash:', hash);
});
