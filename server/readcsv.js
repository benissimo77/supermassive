const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

function parseQuizFromCSV(quizID) {

    const parsers = {
        'v1': parseQuizV1
    }

    const version = quizID.split('.')[1] || 'v1';
    const parser = parsers[version];

    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(path.join(__dirname, 'quizdata', quizID + '.csv'))
        .pipe(csv({ headers: false }))
        .on('data', (data) => results.push(data))
        .on('end', () => {
          resolve(parser(results));
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  function parseQuizV1(data) {
    const quiz = {
        title: '',
        description: '',
        rounds: []
    };
    let currentRound = null;
  
    data.forEach((row) => {
        console.log('Parsing:', row);
        const type = row['0'];

        switch (type) {
            case 'quiz':
            quiz.title = row['1'];
            quiz.description = row['2'];
            break;

            case 'round':
                currentRound = {
                    title: row['1'],
                    description: row['2'],
                    questions: []
                };
                if ('3' in row) {
                    console.log('parsing overrides:', row['3']);
                    currentRound.overrides = JSON.parse(row['3']);
                }
                quiz.rounds.push(currentRound);
                break;

            case 'question':
            if (currentRound) {
                const question = parseQuestion(Object.values(row));
                currentRound.questions.push(question);
            }
            break;

            default:
            console.warn(`Unknown type: ${type}`);
        }
    })
  
    return quiz;
}

// parseQuestion
// Slightly different as the columns have been converted to an array
// This allows to use the spread operator to get the answers
function parseQuestion(questionArray) {
    const [q, type, question, ...rest] = questionArray;
    var ret = {
        type: type,
        question:question
    };
    var answers = rest;
    // the final answer might actually be a JSON object holding question overrides - if so pull it out and store separately
    console.log('question parsing:', answers, answers[answers.length-1], answers.length);
    if ((answers.length > 0) && (answers[answers.length-1].startsWith('{'))) {
        ret.overrides = JSON.parse(answers.pop());
    }
    ret.answers = answers;
    return ret;
}


// Testing - just call the fn directly...
// parseQuizFromCSV('quiz1.v1').then((quiz) => {
//     return quiz;
// });

module.exports = parseQuizFromCSV;
