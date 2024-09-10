// Game Class
// The Game class is an abstract class that defines the basic structure of a game. It contains the following methods:
// introduction: A placeholder method that should be overridden by the child class to provide an introduction to the game.
// checkGameRequirements: A placeholder method that should be overridden by the child class to define the logic for checking if the game requirements are met.
// startGame: A placeholder method that should be overridden by the child class to define the logic for starting the game.
// endGame: A placeholder method that should be overridden by the child class to define the logic for ending the game.

// The Game class also checks if the child class has overridden the above  methods. If not, it throws an error.
// Game class also provides a set of functions that need not be overridden, these perform typical functions that are common to all games.


class Game {
    constructor(room) {
      if (new.target === Game) {
        throw new TypeError("Cannot construct Game instances directly");
      }
  
      if (this.startGame === undefined || this.startGame === Game.prototype.startGame) {
        throw new TypeError("Must override method startGame");
      }
  
      if (this.endGame === undefined || this.endGame === Game.prototype.endGame) {
        throw new TypeError("Must override method endGame");
      }

      if (this.introduction === undefined || this.introduction === Game.prototype.introduction) {
        throw new TypeError("Must override method introduction");
      }
      if (this.checkGameRequirements === undefined || this.checkGameRequirements === Game.prototype.checkGameRequirements) {
        throw new TypeError("Must override method checkGameRequirements");
      }

      // Perform typical startup functions that all games will likely use
      this.room = room;
      this.players = room.players;
      this.started = false;

      room.clientResponseHandler = null;
      room.hostResponseHandler = null;
  
    }
  
    introduction() {
      // Placeholder method
    }
    checkGameRequirements() {
      // Placeholder method
    }
    startGame() {
      // Placeholder method
    }
  
    endGame() {
      // Placeholder method
    }
  }
  
  module.exports = Game;
  