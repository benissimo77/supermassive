const express = require('express');
const Quiz = require('../models/mongo.quiz');

const router = express.Router();

// Filter out questions from quiz data
const filterQuestions = (quiz, user) => {
    console.log('1 Filtering questions:', quiz.title, user, quiz.rounds.length, quiz.rounds);
    quiz.rounds.forEach((round, index) => {
        if (round.owner && round.owner.toString() != user) {
            console.log('user NOT owner', round.owner, user);
            round.questions = [];
        }
    });
    console.log('Done:', quiz);
    return quiz;
}

// Create a new quiz
router.post('/save', async (req, res) => {

    console.log('api.quiz: post /save', req.body, req.user, req.session.passport);
    const newQuiz = req.body;  // for ease of undestanding
    let thisQuiz;   // This will be set to the quiz from DB if one exists

    // Development - initiate a user to simulate being logged-in
    // if (process.env.NODE_ENV == 'development') {
    //     if (!req.user) {
    //         req.user = '67150d8c98c76cabc58b7160';
    //     }
    // }

    // Check quiz _id to determine if this is a first-time save or not
    // _id is null (falsy) when never saved to DB before - this is NOT the same as _id not being there, so we must delete falsy _ids to allow DB to create them
    if (!newQuiz._id) {
        console.log('No _id, first time save:', newQuiz, req.user);
        delete newQuiz._id;
        // Add this user as owner to quiz and all current rounds
        newQuiz.owner = req.user;
        newQuiz.rounds.forEach( round => {
            if (!round.owner) round.owner = req.user;
            if (!round._id) delete round._id;
        });
        thisQuiz = new Quiz(newQuiz);
        console.log('Quiz created:', newQuiz, thisQuiz);
        try {
            await thisQuiz.save();
            return res.status(200).json(filterQuestions(thisQuiz, req.user));
        } catch (error) {
            console.log('ERROR:', error);
            return res.status(500).json({ message: error.message });    
        }
    }

    // Since we must have an _id when we get to this point lets load it and use as a base for further merging
    try {
        thisQuiz = await Quiz.findById( newQuiz._id );
        if (!thisQuiz) {
            // This should never happen - could be deliberate corrupting the _id field - quietly fail
            return res.status(201).json({message: 'OK'});
        }    
    } catch(error) {
        return res.status(500).json({message:error.message});
    }

    // If this user is NOT the quiz owner then we need to load the original quiz and merge the round data
    if (req.user && (thisQuiz.owner.toString() != req.user)) {
        console.log('Original quiz found:', thisQuiz._id, thisQuiz.title, thisQuiz.owner);

        // Add/update additional rounds from new quiz
        newQuiz.rounds.forEach( async (newRound) => {
            console.log('Next round:', newRound.title);

            // First try to find this round in the existing quiz (will allow us to identify the correct owner from DB)
            const index = thisQuiz.rounds.findIndex( (thisRound) => {
                return thisRound._id.toString() == newRound._id;
            });
            if (index >= 0) {
                console.log('Round found:', newRound.title, thisQuiz.rounds[index], req.user);
                // Every round should have an owner - but belt and braces check sometimes it seems to be empty
                if (thisQuiz.rounds[index].owner && thisQuiz.rounds[index].owner.toString() == req.user) {
                    console.log('We are the owner:', req.user);
                    thisQuiz.rounds[index] = newRound;
                    thisQuiz.rounds[index].owner = req.user;
                } else {
                    console.log('Not the owner - ignore:', newRound.title);
                }
            } else {
                console.log('New round, add:', newRound.title);
                newRound.owner = req.user;
                thisQuiz.rounds.push( newRound );
            }
        })

    } else {
        console.log('Owner is updating - complete overwrite', newQuiz.title, newQuiz.rounds.length);

        // Must check for any new rounds added and assign them to this user
        newQuiz.rounds.forEach( round => { if (!round.owner) round.owner = req.user });
        thisQuiz = new Quiz( newQuiz );
    }

    try {
        await Quiz.findByIdAndUpdate(thisQuiz._id, thisQuiz);
        res.status(200).json(filterQuestions(thisQuiz, req.user));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all quizzes (public and personal)
router.get('/', async (req, res) => {
    console.log('api.quiz.js: GET /', req.user);

    if (process.env.NODE_ENV == 'development') {
        if (!req.user) {
            req.user = '67150d8c98c76cabc58b7160';
        }
    }

    const search = {
        $or: [
            { owner: req.user },
            { public: true }
        ]
    }

    const quizzes = await Quiz.find(search);
        console.log('Quizzes found:', quizzes.length, req.user);
        const filteredQuizzes = quizzes.map( quiz => filterQuestions(quiz, req.user) );
        console.log('Filtered:', filteredQuizzes);
        res.status(200).json(filteredQuizzes);
});

// Get a specific quiz by ID
router.get('/:id', async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        res.status(200).json(filterQuestions(quiz, req.user));

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Delete a quiz
router.delete('/:id', async (req, res) => {
    try {
        const quiz = await Quiz.findByIdAndDelete(req.params.id);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        res.status(204).json(quiz);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// Delete a quizround
router.delete('/:id/:roundid', async (req, res) => {
    console.log('api.quiz delete quiz, round:', req.params.id, req.params.roundid);
    try {
        const thisQuiz = await Quiz.findById(req.params.id);
        console.log('Quiz found:', thisQuiz);
        if (!thisQuiz) return res.status(404).json({ message: 'Quiz not found' });
        const index = thisQuiz.rounds.findIndex( (thisRound) => {
            return thisRound._id.toString() == req.params.roundid;
        });
        console.log('Searched rounds of quiz, index:', index);
        if (index >= 0) {
            const thisRound = thisQuiz.rounds[index];
            console.log('Round found, delete:', req.params.roundid, thisRound.owner);
            if (thisRound.owner && thisRound.owner.toString() == req.user) {
                thisQuiz.rounds.splice(index, 1); // Use splice to remove the element from the array
                thisQuiz.save();
                console.log('Quiz saved:', thisQuiz);
            }
        } else {
            console.log('Round not found... STOP');
        }
        res.status(204).json();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;