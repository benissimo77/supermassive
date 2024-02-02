// models/userModel.js

class User {
    constructor(id, username, email) {
      this.id = id;
      this.name = name;
    }
  
    // Example method to get user data by ID
    getUserById(userId) {
      // In a real application, this method might fetch data from a database
      // For simplicity, we're using a hardcoded user here
      const user = {
        id: userId,
        username: 'john_doe'
      };
  
      return new User(user.id, user.username, user.email);
    }
  
    // Other methods related to user actions...
  }
  
  module.exports = User;
  