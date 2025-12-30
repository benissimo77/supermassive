
import { BaseScene } from './BaseScene';
import FSM from './fsm';
import MoneyTreeState from "./MoneyTreeState";
import { StateDebuggerPanel } from "./StateDebugger";
import MoneyTreeComponent from './moneytreecomponent';
import SocketManagerPlugin from './socketManager';
import WebFontLoaderPlugin from 'phaser3-rex-plugins/plugins/webfontloader-plugin.js';


class Question {
    question: string;
    answers: string[];
    correct: number;
    questionIndex: number = -1;
    selectedAnswerIndex: number = -1;

    constructor(questionData: { questionIndex: number, question: string, answers: string[], correct: number }, questionIndexNotUsed: number = -1) {
        this.question = questionData.question;
        this.answers = questionData.answers;
        this.correct = questionData.correct;
        this.questionIndex = questionData.questionIndex;
        this.selectedAnswerIndex = -1; // Initialize to -1 or any other default value
    }
}



export default class MoneyTreeScene extends BaseScene {

    private moneyamounts: number[] = [
        1, 2, 5, 10, 25,
        50, 75, 100, 200, 500,
        1000, 2500, 5000, 10000, 15000,
        25000, 50000, 75000, 100000, 150000,
        250000
    ]

    private questions: Question[] = []; // Array to hold the questions

    private questionData1: { questionIndex: number, question: string, answers: string[], correct: number }[] = [
        {
            "questionIndex": 20,
            "question": "In literature, what is the name of the ship in Moby-Dick?",
            "answers": ["Pequod", "Essex", "Resolute"],
            "correct": 0
        },
        {
            "questionIndex": 19,
            "question": "Which philosopher wrote Being and Time?",
            "answers": ["Martin Heidegger", "Friedrich Nietzsche", "Jean-Paul Sartre"],
            "correct": 0
        },
        {
            "questionIndex": 18,
            "question": "Which physicist first proposed the idea of quantum energy packets called \"quanta\"?",
            "answers": ["Albert Einstein", "Max Planck", "Niels Bohr"],
            "correct": 1
        },
        {
            "questionIndex": 17,
            "question": "What is the rarest of these blood types in humans?",
            "answers": ["AB+", "AB-", "O"],
            "correct": 1
        },
        {
            "questionIndex": 16,
            "question": "Which of these is a botanical berry?",
            "answers": ["Strawberry", "Banana", "Apple"],
            "correct": 1
        },
        {
            "questionIndex": 15,
            "question": "What is the only country in the world whose flag is not rectangular or square?",
            "answers": ["Bhutan", "Nepal", "Vatican City"],
            "correct": 1
        },
        {
            "questionIndex": 14,
            "question": "Which country was formerly known as Abyssinia?",
            "answers": ["Sudan", "Ethiopia", "Libya"],
            "correct": 1
        },
        {
            "questionIndex": 13,
            "question": "What part of the brain is responsible for balance and coordination?",
            "answers": ["Cerbrum", "Brainstem", "Cerebellum"],
            "correct": 2
        },
        {
            "questionIndex": 12,
            "question": "Which language is the most spoken in the world by native speakers?",
            "answers": ["Mandarin Chinese", "English", "Spanish"],
            "correct": 0
        },
        {
            "questionIndex": 11,
            "question": "In what year was the first email sent?",
            "answers": ["1981", "1971", "1965"],
            "correct": 1
        },
        {
            "questionIndex": 10,
            "question": "What is the capital city of Canada?",
            "answers": ["Toronto", "Ottowa", "Vancouver"],
            "correct": 1
        },
        {
            "questionIndex": 9,
            "question": "Which ocean lies between Africa and Australia?",
            "answers": ["Pacific", "Indian", "Southern"],
            "correct": 1
        },
        {
            "questionIndex": 8,
            "question": "In Greek mythology, who is the god of the underworld?",
            "answers": ["Apollo", "Zeus", "Hades"],
            "correct": 2
        },
        {
            "questionIndex": 7,
            "question": "Which Shakespeare play features the characters Goneril, Regan, and Cordelia?",
            "answers": ["Hamlet", "Macbeth", "King Lear"],
            "correct": 2
        },
        {
            "questionIndex": 6,
            "question": "What’s the smallest country in the world by land area?",
            "answers": ["Monaco", "Vatican City", "San Marino"],
            "correct": 1
        },
        {
            "questionIndex": 5,
            "question": "Which metal has the chemical symbol Fe?",
            "answers": ["Iron", "Silver", "Lead"],
            "correct": 0
        },
        {
            "questionIndex": 4,
            "question": "In which year did the Berlin Wall fall?",
            "answers": ["1991", "1985", "1989"],
            "correct": 2
        },
        {
            "questionIndex": 3,
            "question": "What is the name of the longest bone in the human body?",
            "answers": ["Tibia", "Femur", "Humerus"],
            "correct": 1
        },
        {
            "questionIndex": 2,
            "question": "In computing, what does \"CPU\" stand for?",
            "answers": ["Central Processing Unit", "Central Power Unit", "Computer Power Utility"],
            "correct": 0
        },
        {
            "questionIndex": 1,
            "question": "How many legs does a spider have?",
            "answers": ["Six", "Eight", "Ten"],
            "correct": 1
        },
        {
            "questionIndex": 0,
            "question": "Which planet is known as the Red Planet?",
            "answers": ["Mars", "Venus", "Jupiter"],
            "correct": 0
        }
    ];
    private questionData2 = [
        {
            "questionIndex": 0,
            "question": "Who was the 1st person in space?",
            "answers": ["Neil Armstrong", "Gherman Titov", "Yuri Gagarin"],
            "correct": 2
        },
        {
            "questionIndex": 1,
            "question": "What’s the square root of 144?",
            "answers": ["10", "12", "20"],
            "correct": 1
        },
        {
            "questionIndex": 2,
            "question": "A recipe calls for flour and sugar in the ratio 3:2. If you use 18 cups of flour, how much sugar should you use?",
            "answers": ["6 Cups", "12 Cups", "8 Cups"],
            "correct": 1
        },
        {
            "questionIndex": 3,
            "question": "How many players are there in a Rugby Union team?",
            "answers": ["11", "13", "15"],
            "correct": 2
        },
        {
            "questionIndex": 4,
            "question": "Whats the chemical symbol for Gold?",
            "answers": ["Ag", "Au", "Fe"],
            "correct": 1
        },
        {
            "questionIndex": 5,
            "question": "What color is a Himalayan salt lamp typically?",
            "answers": ["Pink", "White", "Pale Blue"],
            "correct": 0
        },
        {
            "questionIndex": 6,
            "question": "Who is the Greek god of the sea?",
            "answers": ["Atlas", "Zeus", "Poseiden"],
            "correct": 2
        },
        {
            "questionIndex": 7,
            "question": "What is the Capital of Morocco?",
            "answers": ["Algiers", "Tunis", "Rabat"],
            "correct": 2
        },
        {
            "questionIndex": 8,
            "question": "What team did Brian Clough manage to two European Cups in Football?",
            "answers": ["Nottingham Forest", "Liverpool", "Manchester United"],
            "correct": 0
        },
        {
            "questionIndex": 9,
            "question": "What’s the longest river in Asia?",
            "answers": ["Mekong", "Yantze", "Ganges"],
            "correct": 1
        },
        {
            "questionIndex": 10,
            "question": "Who wrote the novel Moby-Dick?",
            "answers": ["Mark Twain", "Herman Melville", "F.Scott Fitzgerald"],
            "correct": 1
        },
        {
            "questionIndex": 11,
            "question": "Which video game franchise features Hyrule and the Master Sword?",
            "answers": ["Final Fantasy", "The Legend of Zelda", "Medal of Honour"],
            "correct": 1
        },
        {
            "questionIndex": 12,
            "question": "What is the capital of Bhutan?",
            "answers": ["Thimphu", "Kathmandu", "Dhaka"],
            "correct": 0
        },
        {
            "questionIndex": 13,
            "question": "What element has the atomic number 92?",
            "answers": ["Uranium", "Plutonium", "Thorium"],
            "correct": 0
        },
        {
            "questionIndex": 14,
            "question": "Which author used the pen name Richard Bachman?",
            "answers": ["Stephen King", "JK Rowling", "Clive Barker"],
            "correct": 0
        },
        {
            "questionIndex": 15,
            "question": "Which of these was a real programming language in the 1960s?",
            "answers": ["LISP", "PYTHON", "C++"],
            "correct": 0
        },
        {
            "questionIndex": 16,
            "question": "What unit measures radiation dosage?",
            "answers": ["Tesla", "Sievert", "Pascal"],
            "correct": 1
        },
        {
            "questionIndex": 17,
            "question": "Who painted The Garden of Earthly Delights?",
            "answers": ["Hieronymus Bosch", "Pieter Bruegel the Elder", "Albrecht Dürer"],
            "correct": 0
        },
        {
            "questionIndex": 18,
            "question": "What was the name of Horatio Nelson’s ship at the Battle of the Nile in 1798?",
            "answers": ["HMS Vanguard", "HMS Victory", "HMS Terror"],
            "correct": 0
        },
        {
            "questionIndex": 19,
            "question": "Which film won Best Picture at the 2020 Academy Awards?",
            "answers": ["1917", "Nomadland", "Parasite"],
            "correct": 2
        },
        {
            "questionIndex": 20,
            "question": "Which artist holds the record for the longest-running No. 1 single on the Billboard Hot 100?",
            "answers": ["Mariah Carey", "Lil Nas X", "Katy Perry"],
            "correct": 1
        }
    ];
    private questionData3 = [
        {
            "questionIndex": 0,
            "question": "What is the boiling point of water in Celsius?",
            "answers": ["0°C", "100°C", "101°C"],
            "correct": 1
        },
        {
            "questionIndex": 1,
            "question": "Which is not a primary color?",
            "answers": ["Red", "Green", "Blue"],
            "correct": 1
        },
        {
            "questionIndex": 2,
            "question": "Who painted the Mona Lisa?",
            "answers": ["Vincent van Gogh", "Leonardo da Vinci", "Michelangelo"],
            "correct": 1
        },
        {
            "questionIndex": 3,
            "question": "What language is primarily spoken in Brazil?",
            "answers": ["Spanish", "Portuguese", "French"],
            "correct": 1
        },
        {
            "questionIndex": 4,
            "question": "What is the currency of Thailand?",
            "answers": ["Yen", "Baht", "Rupee"],
            "correct": 1
        },
        {
            "questionIndex": 5,
            "question": "Who is the author of The Hobbit?",
            "answers": ["George R.R. Martin", "Lewis Caroll", "J.R.R. Tolkien"],
            "correct": 2
        },
        {
            "questionIndex": 6,
            "question": "Which continent has the most countries?",
            "answers": ["Asia", "Europe", "Africa"],
            "correct": 2
        },
        {
            "questionIndex": 7,
            "question": "Which blood type is a universal donor?",
            "answers": ["O-", "AB+", "AB-"],
            "correct": 0
        },
        {
            "questionIndex": 8,
            "question": "Which ocean is the largest?",
            "answers": ["Atlantic", "Indian", "Pacific"],
            "correct": 2
        },
        {
            "questionIndex": 9,
            "question": "What is the longest river in Europe?",
            "answers": ["Danube", "Volga", "Rhine"],
            "correct": 1
        },
        {
            "questionIndex": 10,
            "question": "How many bones are in the adult human body?",
            "answers": ["156", "206", "256"],
            "correct": 1
        },
        {
            "questionIndex": 11,
            "question": "Who wrote the novel The Catcher in the Rye?",
            "answers": ["John Steinbeck", "J.D. Salinger", "Ernest Hemingway"],
            "correct": 1
        },
        {
            "questionIndex": 12,
            "question": "Which battle marked the end of Napoleon's rule in 1815?",
            "answers": ["Austerlitz", "Leipzig", "Waterloo"],
            "correct": 2
        },
        {
            "questionIndex": 13,
            "question": "What is the largest organ in the human body?",
            "answers": ["Skin", "Liver", "Heart"],
            "correct": 0
        },
        {
            "questionIndex": 14,
            "question": "Which Nintendo character made his debut in the game Donkey Kong (1981)?",
            "answers": ["Pikachu", "Mario", "Sonic"],
            "correct": 1
        },
        {
            "questionIndex": 15,
            "question": "What element has the highest electrical conductivity?",
            "answers": ["Copper", "Gold", "Silver"],
            "correct": 2
        },
        {
            "questionIndex": 16,
            "question": "What political theory is Karl Popper known for critiquing?",
            "answers": ["Totalitarianism", "Utopianism", "Historicism"],
            "correct": 2
        },
        {
            "questionIndex": 17,
            "question": "Which planet has the most moons?",
            "answers": ["Jupiter", "Saturn", "Neptune"],
            "correct": 1
        },
        {
            "questionIndex": 18,
            "question": "What is an irrational number?",
            "answers": ["Cannot be a ratio of two integers", "One that is imaginary", "One that is undefined"],
            "correct": 0
        },
        {
            "questionIndex": 19,
            "question": "Which Country has the most time zones?",
            "answers": ["France", "Russia", "USA"],
            "correct": 1
        },
        {
            "questionIndex": 20,
            "question": "In formal logic, what does the symbol \"⊨\" mean?",
            "answers": ["Logical negation", "Semantic Entailment", "Biconditional"],
            "correct": 1
        }
    ];
    private questionData4: { questionIndex: number, question: string, answers: string[], correct: number }[] = [
        {
            "questionIndex": 20,
            "question": "Which treaty ended the Thirty Years War in 1648?",
            "answers": ["Treaty of Utrecht", "Treaty of Vienna", "Peace of Westphalia"],
            "correct": 2
        },
        {
            "questionIndex": 19,
            "question": "Which element has the atomic number 1?",
            "answers": ["Helium", "Oxygen", "Hydrogen"],
            "correct": 2
        },
        {
            "questionIndex": 18,
            "question": "How many bones are there in the adult human body?",
            "answers": ["201", "206", "212"],
            "correct": 1
        },
        {
            "questionIndex": 17,
            "question": "Which country was formerly known as Persia?",
            "answers": ["Iraq", "Iran", "Turkey"],
            "correct": 1
        },
        {
            "questionIndex": 16,
            "question": "Which war ended with the Treaty of Versailles?",
            "answers": ["Napoleonic Wars", "World War I", "World War II"],
            "correct": 1
        },
        {
            "questionIndex": 15,
            "question": "What is the capital of Canada?",
            "answers": ["Toronto", "Montreal", "Ottawa"],
            "correct": 2
        },
        {
            "questionIndex": 14,
            "question": "What is the chemical symbol for gold?",
            "answers": ["Ag", "Au", "Pb"],
            "correct": 1
        },
        {
            "questionIndex": 13,
            "question": "Which artist painted The Last Supper?",
            "answers": ["Michelangelo", "Raphael", "Leonardo da Vinci"],
            "correct": 2
        },
        {
            "questionIndex": 12,
            "question": "Which organ in the human body produces insulin?",
            "answers": ["Liver", "Kidney", "Pancreas"],
            "correct": 2
        },
        {
            "questionIndex": 11,
            "question": "Which country hosted the 2016 Summer Olympics?",
            "answers": ["China", "United Kingdom", "Brazil"],
            "correct": 2
        },
        {
            "questionIndex": 10,
            "question": "Who was the first woman to win a Nobel Prize?",
            "answers": ["Jane Goodall", "Rosalind Franklin", "Marie Curie"],
            "correct": 2
        },
        {
            "questionIndex": 9,
            "question": "What is the largest ocean on Earth?",
            "answers": ["Atlantic", "Indian", "Pacific"],
            "correct": 2
        },
        {
            "questionIndex": 8,
            "question": "Who wrote Animal Farm?",
            "answers": ["Aldous Huxley", "George Orwell", "Ray Bradbury"],
            "correct": 1
        },
        {
            "questionIndex": 7,
            "question": "Which element has the chemical symbol \"Na\"?",
            "answers": ["Nitrogen", "Sodium", "Neon"],
            "correct": 1
        },
        {
            "questionIndex": 6,
            "question": "In which year did the Berlin Wall fall?",
            "answers": ["1987", "1989", "1991"],
            "correct": 1
        },
        {
            "questionIndex": 5,
            "question": "Which mountain is the highest above sea level?",
            "answers": ["K2", "Kangchenjunga", "Mount Everest"],
            "correct": 2
        },
        {
            "questionIndex": 4,
            "question": "Which scientist proposed the theory of general relativity?",
            "answers": ["Isaac Newton", "Galileo Galilei", "Albert Einstein"],
            "correct": 2
        },
        {
            "questionIndex": 3,
            "question": "Which country uses the yen as its currency?",
            "answers": ["China", "South Korea", "Japan"],
            "correct": 2
        },
        {
            "questionIndex": 2,
            "question": "Which gas makes up the largest percentage of Earth's atmosphere?",
            "answers": ["Oxygen", "Carbon dioxide", "Nitrogen"],
            "correct": 2
        },
        {
            "questionIndex": 1,
            "question": "Which sport uses the term \"love\" for a score of zero?",
            "answers": ["Badminton", "Squash", "Tennis"],
            "correct": 2
        },
        {
            "questionIndex": 0,
            "question": "What is the capital of Italy?",
            "answers": ["Milan", "Venice", "Rome"],
            "correct": 2
        }
    ];
    private questionData5: { questionIndex: number, question: string, answers: string[], correct: number }[] = [
        {
            "questionIndex": 20,
            "question": "Which mathematician proved Fermat's Last Theorem in 1994?",
            "answers": ["Pierre de Fermat", "Grigori Perelman", "Andrew Wiles"],
            "correct": 2
        },
        {
            "questionIndex": 19,
            "question": "Who wrote Pale Fire?",
            "answers": ["Kingsley Amis", "Vladimir Nabokov", "John Fowles"],
            "correct": 1
        },
        {
            "questionIndex": 18,
            "question": "Which chemical element has the symbol “Sn”?",
            "answers": ["Lead", "Silicon", "Tin"],
            "correct": 2
        },
        {
            "questionIndex": 17,
            "question": "How many strings does a standard violin have?",
            "answers": ["Three", "Four", "Five"],
            "correct": 1
        },
        {
            "questionIndex": 16,
            "question": "Which scientist developed the laws of motion?",
            "answers": ["Albert Einstein", "Isaac Newton", "Nikola Tesla"],
            "correct": 1
        },
        {
            "questionIndex": 15,
            "question": "Which sea separates Europe and Africa?",
            "answers": ["Black Sea", "Red Sea", "Mediterranean Sea"],
            "correct": 2
        },
        {
            "questionIndex": 14,
            "question": "Which country won the FIFA World Cup in 2018?",
            "answers": ["Croatia", "Brazil", "France"],
            "correct": 2
        },
        {
            "questionIndex": 13,
            "question": "Which empire was ruled by Genghis Khan?",
            "answers": ["Ottoman Empire", "Roman Empire", "Mongol Empire"],
            "correct": 2
        },
        {
            "questionIndex": 12,
            "question": "Who painted the ceiling of the Sistine Chapel?",
            "answers": ["Leonardo da Vinci", "Raphael", "Michelangelo"],
            "correct": 2
        },
        {
            "questionIndex": 11,
            "question": "Which language has the most native speakers in Europe?",
            "answers": ["English", "French", "German"],
            "correct": 2
        },
        {
            "questionIndex": 10,
            "question": "Which blood type is known as the universal donor?",
            "answers": ["A", "B", "O -"],
            "correct": 2
        },
        {
            "questionIndex": 9,
            "question": "What is the smallest planet in our solar system?",
            "answers": ["Mars", "Mercury", "Venus"],
            "correct": 1
        },
        {
            "questionIndex": 8,
            "question": "Which country gifted the Statue of Liberty to the United States?",
            "answers": ["United Kingdom", "Germany", "France"],
            "correct": 2
        },
        {
            "questionIndex": 7,
            "question": "Who was the first President of the United States?",
            "answers": ["Thomas Jefferson", "John Adams", "George Washington"],
            "correct": 2
        },
        {
            "questionIndex": 6,
            "question": "What is the capital of Norway?",
            "answers": ["Stockholm", "Copenhagen", "Oslo"],
            "correct": 2
        },
        {
            "questionIndex": 5,
            "question": "Which planet is famous for its prominent ring system?",
            "answers": ["Jupiter", "Uranus", "Saturn"],
            "correct": 2
        },
        {
            "questionIndex": 4,
            "question": "Which city is known as “The Eternal City”?",
            "answers": ["Athens", "Jerusalem", "Rome"],
            "correct": 2
        },
        {
            "questionIndex": 3,
            "question": "What is the longest bone in the human body?",
            "answers": ["Tibia", "Humerus", "Femur"],
            "correct": 2
        },
        {
            "questionIndex": 2,
            "question": "Which metal is liquid at room temperature?",
            "answers": ["Lead", "Mercury", "Aluminium"],
            "correct": 1
        },
        {
            "questionIndex": 1,
            "question": "What is the square root of 144?",
            "answers": ["10", "12", "14"],
            "correct": 1
        },
        {
            "questionIndex": 0,
            "question": "What is the main ingredient in traditional Japanese miso?",
            "answers": ["Rice", "Soybeans", "Seaweed"],
            "correct": 1
        }
    ];
    private questionData6: { questionIndex: number, question: string, answers: string[], correct: number }[] = [
        {
            "questionIndex": 20,
            "question": "Who wrote \"The Lover\" (L'Amant)?",
            "answers": ["Simone de Beauvoir", "Marguerite Duras", "Annie Ernaux"],
            "correct": 1
        },
        {
            "questionIndex": 19,
            "question": "What is the SI unit of electrical current?",
            "answers": ["Volt", "Ampere", "Watt"],
            "correct": 1
        },
        {
            "questionIndex": 18,
            "question": "In which year did Constantinople fall to the Ottoman Empire?",
            "answers": ["1492", "1453", "1517"],
            "correct": 1
        },
        {
            "questionIndex": 17,
            "question": "Which planet has the strongest gravitational pull?",
            "answers": ["Earth", "Jupiter", "Saturn"],
            "correct": 1
        },
        {
            "questionIndex": 16,
            "question": "Which metal is traditionally used to make electrical wiring?",
            "answers": ["Iron", "Copper", "Aluminium"],
            "correct": 1
        },
        {
            "questionIndex": 15,
            "question": "Which desert is the largest hot desert in the world?",
            "answers": ["Gobi", "Sahara", "Arabian"],
            "correct": 1
        },
        {
            "questionIndex": 14,
            "question": "Which country has won the most FIFA World Cups?",
            "answers": ["Germany", "Italy", "Brazil"],
            "correct": 2
        },
        {
            "questionIndex": 13,
            "question": "Which ancient civilisation built Machu Picchu?",
            "answers": ["Aztec", "Inca", "Maya"],
            "correct": 1
        },
        {
            "questionIndex": 12,
            "question": "What is the currency of Switzerland?",
            "answers": ["Euro", "Franc", "Krone"],
            "correct": 1
        },
        {
            "questionIndex": 11,
            "question": "Which ocean lies between Africa and Australia?",
            "answers": ["Atlantic", "Indian", "Pacific"],
            "correct": 1
        },
        {
            "questionIndex": 10,
            "question": "Which painter is associated with the Cubist movement?",
            "answers": ["Salvador Dalí", "Pablo Picasso", "Henri Matisse"],
            "correct": 1
        },
        {
            "questionIndex": 9,
            "question": "Who developed the theory of evolution by natural selection?",
            "answers": ["Gregor Mendel", "Charles Darwin", "Louis Pasteur"],
            "correct": 1
        },
        {
            "questionIndex": 8,
            "question": "What is the largest island in the world?",
            "answers": ["Greenland", "Borneo", "Madagascar"],
            "correct": 0
        },
        {
            "questionIndex": 7,
            "question": "Which country was the first to grant women the right to vote?",
            "answers": ["United States", "United Kingdom", "New Zealand"],
            "correct": 2
        },
        {
            "questionIndex": 6,
            "question": "Who wrote the novel '1984'?",
            "answers": ["George Orwell", "Aldous Huxley", "Ray Bradbury"],
            "correct": 0
        },
        {
            "questionIndex": 5,
            "question": "Which element has the chemical symbol 'K'?",
            "answers": ["Potassium", "Krypton", "Calcium"],
            "correct": 0
        },
        {
            "questionIndex": 4,
            "question": "Which city is home to the EU's main institutions?",
            "answers": ["Brussels", "Strasbourg", "Luxembourg"],
            "correct": 0
        },
        {
            "questionIndex": 3,
            "question": "What is the largest internal organ in the human body?",
            "answers": ["Brain", "Liver", "Lungs"],
            "correct": 1
        },
        {
            "questionIndex": 2,
            "question": "Which country has the longest coastline in the world?",
            "answers": ["Russia", "Canada", "Australia"],
            "correct": 1
        },
        {
            "questionIndex": 1,
            "question": "What is the capital of South Korea?",
            "answers": ["Busan", "Jakarta", "Seoul"],
            "correct": 2
        },
        {
            "questionIndex": 0,
            "question": "Who was the first human to travel into space?",
            "answers": ["Neil Armstrong", "Yuri Gagarin", "Buzz Aldrin"],
            "correct": 1
        }
    ];

    private allinQuestionData: Question[] = [
        {
            "question": "What is the hardest natural substance on Earth?",
            "answers": ["Correct", "Incorrect"],
            "correct": 0,
            "questionIndex": 0,
            "selectedAnswerIndex": -1
        },
        {
            "question": "Which planet is closest to the sun?",
            "answers": ["Correct", "Incorrect"],
            "correct": 0,
            "questionIndex": 1,
            "selectedAnswerIndex": -1
        },
        {
            "question": "In which year did the Titanic sink?",
            "answers": ["Correct", "Incorrect"],
            "correct": 0,
            "questionIndex": 2,
            "selectedAnswerIndex": -1
        },
        {
            "question": "Who is known as the father of modern physics?",
            "answers": ["Correct", "Incorrect"],
            "correct": 0,
            "questionIndex": 3,
            "selectedAnswerIndex": -1
        },
        {
            "question": "Which author wrote \"If on a Winter's Night a Traveler?\"",
            "answers": ["Correct", "Incorrect"],
            "correct": 0,
            "questionIndex": 4,
            "selectedAnswerIndex": -1
        },
        {
            "question": "Who wrote \"Things Fall Apart\"?",
            "answers": ["Correct", "Incorrect"],
            "correct": 0,
            "questionIndex": 5,
            "selectedAnswerIndex": -1
        },
        {
            "question": "Which chemical element has the highest melting point?",
            "answers": ["Correct", "Incorrect"],
            "correct": 0,
            "questionIndex": 6,
            "selectedAnswerIndex": -1
        }
    ];

    // Set up the FSM and the transitions between states
    private transitions: Record<MoneyTreeState, MoneyTreeState[]> = {
        SPLASH: [MoneyTreeState.INTRO],
        INTRO: [MoneyTreeState.CHOOSE_ENVELOPE],
        CHOOSE_ENVELOPE: [MoneyTreeState.INTRO_ROUND, MoneyTreeState.END_ROUND],
        INTRO_ROUND: [MoneyTreeState.QUESTION],
        QUESTION: [MoneyTreeState.ANSWER],
        ANSWER: [MoneyTreeState.QUESTION, MoneyTreeState.END_ROUND],
        END_ROUND: [MoneyTreeState.FINAL_CHOICE],
        FINAL_CHOICE: [MoneyTreeState.PLAY_SAFE, MoneyTreeState.GAMBLE, MoneyTreeState.ALLIN],
        PLAY_SAFE: [MoneyTreeState.END_QUIZ],
        CHECK_ENVELOPE: [MoneyTreeState.END_QUIZ],
        GAMBLE: [MoneyTreeState.GAMBLE_WON, MoneyTreeState.GAMBLE_LOST],
        GAMBLE_WON: [MoneyTreeState.END_QUIZ],
        GAMBLE_LOST: [MoneyTreeState.END_QUIZ],
        ALLIN: [MoneyTreeState.ALLIN_WON, MoneyTreeState.ALLIN_LOST],
        ALLIN_WON: [MoneyTreeState.END_QUIZ],
        ALLIN_LOST: [MoneyTreeState.END_QUIZ],
        END_QUIZ: [MoneyTreeState.SAVE_RESULTS],
        SAVE_RESULTS: [MoneyTreeState.SPLASH],
        DEBUG: [MoneyTreeState.DEBUG]
    };

    private stateActions: Record<MoneyTreeState, () => void> = {
        SPLASH: () => this.splash(),
        INTRO: () => this.introQuiz(),
        CHOOSE_ENVELOPE: () => this.chooseEnvelope(),
        INTRO_ROUND: () => this.introRound(),
        QUESTION: () => this.nextQuestion(),
        ANSWER: () => this.showAnswer(),
        END_ROUND: () => this.endRound(),
        FINAL_CHOICE: () => this.finalChoice(),
        PLAY_SAFE: () => this.playSafe(),
        CHECK_ENVELOPE: () => this.checkEnvelope(),
        GAMBLE: () => this.gamble(),
        GAMBLE_WON: () => this.gambleWon(),
        GAMBLE_LOST: () => this.gambleLost(),
        ALLIN: () => this.allin(),
        ALLIN_WON: () => this.allinWon(),
        ALLIN_LOST: () => this.allinLost(),
        END_QUIZ: () => this.endQuiz(),
        SAVE_RESULTS: () => this.saveResults(),
        DEBUG: () => this.debug()
    };

    // The Finite State Machine (FSM) instance for managing the quiz state transitions
    private FSM: FSM;
    private stateDebugger: StateDebuggerPanel;

    // Two different money tree components (amounts, numbers)
    private moneyAmountsTree: MoneyTreeComponent;
    private questionNumbersTree: MoneyTreeComponent;

    // Groups for tracking envelopes and correct/incorrect answers
    private envelopeContainer: Phaser.GameObjects.Container;
    private envelopes: Phaser.GameObjects.Sprite[] = [];
    private correctAnswerContainer: Phaser.GameObjects.Container;
    private incorrectAnswerContainer: Phaser.GameObjects.Container;

    // Stores the current question object - everything needed to display the question and answers
    // Also store the final envelope so it can be displayed at the end
    private currentQuestion: Question;
    private finalQuestion: Question;
    private finalEnvelope: Phaser.GameObjects.Sprite;
    private finalDecision: string;
    private thresholdAmount: number;
    private questionData: { questionIndex: number, question: string, answers: string[], correct: number }[];
    private allinQuestion: { question: string, answers: string[], correct: number };

    // SAFE cash won so far
    private safeCash: number = 0;
    private safeCashText: Phaser.GameObjects.Text;

    // ALLIN cash amount
    private allinCash: number = 0;
    private allinCashText: Phaser.GameObjects.Text;

    // Global configs for ease of styling text
    private labelConfig: any;

    constructor() {
        super({ key: "MoneyTree" });
    }

    init(): void {
        console.log('MoneyTree.init: hello:');
        super.init();

        // Prepare the Finite State Machine (FSM) for the logic flow of the quiz
        // Note: FSM has not yet started - this happens in create() since assets must be loaded first
        this.FSM = new FSM(MoneyTreeState.SPLASH, this.transitions, this.stateActions);

    }

    preload(): void {
        // preload assets here if needed
        this.load.image('borderbox', 'assets/rounded-rect-gold-black-200x80x12.png');
        this.load.image('playernamepanel', 'assets/rounded-rect-paleblue-320x32x8.png');
        this.load.image('envelope', 'assets/moneytree-envelope.png');
        this.load.image('studio', 'assets/thetower-studio.jpg');
        this.load.image('splash', 'assets/thetower-splash.jpg');
        this.load.audio('lowtick', ['assets/audio/moneytree-tick.mp3']);
        this.load.audio('hightick', ['assets/audio/moneytree-hightick.mp3']);
        this.load.audio('answercorrect', ['assets/audio/moneytree-answercorrect.wav']);
        this.load.audio('answerincorrect', ['assets/audio/moneytree-answerincorrect.wav']);
        this.load.audio('envelopeopen', ['assets/audio/moneytree-envelopeopen.mp3']);
        this.load.audio('envelopeshuffle', ['assets/audio/moneytree-envelopeshuffle.mp3']);
        this.load.audio('highlightslot', ['assets/audio/moneytree-highlightslot.mp3']);

        this.load.rexWebFont({
            google: {
                families: ['Titan One']
            }
        });

    }

    create(): void {

        console.log("Phaser.create::", this.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas');

        // Time to get the layout right:
        // 80 - numbers
        // 200 - amounts
        // 400 - answers
        // 400 - envelopes (only at beginning when no answers)
        // 600 - 1920 : space for instructions and questions 1200px!
        // 600 - beginning of instructions
        // 1200 - centre line of instruction/question area (centre everything for ease)

        // Instantiate the State Debugger - and a key listener CTRL-ALT-Z for showing/hiding
        this.stateDebugger = new StateDebuggerPanel(this, this.FSM, (state: MoneyTreeState) => this.mockState(state));
        if (this.input.keyboard) {
            this.input.keyboard.on('keydown-D', (event: KeyboardEvent) => {
                if (event.ctrlKey && event.altKey) {
                    this.stateDebugger.toggle();
                }
            });
        }

        this.labelConfig = {
            fontFamily: 'Arial',
            fontSize: 60,
            color: '#cccc00',
            backgroundColor: '#000000',
            padding: { left: 20, right: 20, top: this.getY(8), bottom: this.getY(8) }
        }

        this.FSM.start();


        // DEBUGGING JUST THE ANIMATION
        // for (var i: number = 12; i < 21; i++) {
        //     this.moneyAmountsTree.setSlotState(i, 'revealed');
        // }
        // this.moneyAmountsTree.setSlotState(8, 'revealed');
        // this.moneyAmountsTree.setSlotState(4, 'revealed');
        // this.moneyAmountsTree.setSlotState(2, 'revealed');

        // this.currentQuestion = this.questions[1];
        // this.currentQuestion.selectedAnswerIndex = 2;
        // this.FSM.forceTransitionTo(QuizState.ANSWER);
    }


    debug(): void {

        console.log('Debug: general purpose debug entry point...');
    }

    mockState(state: MoneyTreeState): void {

        console.log('mockState:', state);
        console.log(this.questions);
        switch (state) {

            case MoneyTreeState.ANSWER:
                this.currentQuestion = this.questions[0];
                this.currentQuestion.selectedAnswerIndex = 0;
                break;

            case MoneyTreeState.END_ROUND:
                this.envelopeContainer.x = 3000;
                break;

            case MoneyTreeState.END_QUIZ:
                this.envelopeContainer.x = 3000;
                this.currentQuestion = this.questions[0];
                break;

            default:
        }

    }

    splash(): void {
        console.log('splash: hello:');

        // Add a background image and place a dark overlay over it
        const image = this.add.image(0, 0, 'splash');
        console.log('Image:', image.displayWidth, image.displayHeight, image.scaleX, image.scaleY, image.width, image.height);
        image.scaleX = 1920 / image.width;
        image.scaleY = this.getY(1080) / image.height;
        image.setOrigin(0, 0);

        const overlay: Phaser.GameObjects.Graphics = this.add.graphics();
        overlay.fillStyle(0x000000, 0.4);
        overlay.fillRect(0, 0, 1920, this.getY(1080));

        // Three buttons - one for each game - decides which set of questions you get given
        const gameData: { questionIndex: number, question: string, answers: string[], correct: number }[][] = [this.questionData1, this.questionData2, this.questionData3, this.questionData4, this.questionData5, this.questionData6];

        const container: Phaser.GameObjects.Container = this.add.container();

        for (let i = 0; i < 6; i++) {
            const gameButton = this.add.text(480 + (i%3) * 480, this.getY(120) + Math.floor(i/3) * this.getY(100), `Game ${i + 1}`, {
                fontFamily: 'Arial',
                color: '#000090',
                backgroundColor: '#000000',
                stroke: '#FFFFFF',
                strokeThickness: 4,
                padding: { left: 30, right: 30, top: this.getY(20), bottom: this.getY(20) }
            }).setOrigin(0.5)
                .setFontSize(this.getY(48))
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    buttonPress(i);
                })
                .on('pointerover', () => { gameButton.setBackgroundColor('#333333') })
                .on('pointerout', () => gameButton.setBackgroundColor('#000000'));

            container.add(gameButton);
        }

        const splashText1: Phaser.GameObjects.Text = this.add.text(960, this.getY(880), "An Iconic set that will get everyone talking", {
            fontFamily: 'Titan One',
            fontSize: this.getY(60),
            color: '#ddddff',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5).setStroke('#000000', 2);
        const splashText2: Phaser.GameObjects.Text = this.add.text(960, this.getY(960), "A gameshow mechanism that will get everyone watching!", {
            fontFamily: 'Titan One',
            fontSize: this.getY(60),
            color: '#ddddff',
            stroke: '#000000',
            strokeThickness: 3,
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5).setStroke('#000000', 2);

        container.add([splashText1, splashText2]);

        const buttonPress = (i: number) => {
            this.questionData = gameData[i];
            this.allinQuestion = this.allinQuestionData[i];
            overlay.fillStyle(0x000000, 0.8);
            overlay.fillRect(0, 0, 1920, this.getY(1080));
            this.FSM.transitionTo(MoneyTreeState.INTRO);
        }

        this.FSM.onNextStateChange(() => {
            container.destroy(true);
        });

    }

    setupDisplay(): void {

        // Add a background image and place a dark overlay over it
        const image = this.add.image(0, 0, 'studio');
        console.log('Image:', image.displayWidth, image.displayHeight, image.scaleX, image.scaleY, image.width, image.height);
        image.scaleX = 1920 / image.width;
        image.scaleY = this.getY(1080) / image.height;
        image.setOrigin(0, 0);

        const overlay: Phaser.GameObjects.Graphics = this.add.graphics();
        overlay.fillStyle(0x000000, 0.4);
        overlay.fillRect(0, 0, 1920, this.getY(1080));


        this.questionNumbersTree = new MoneyTreeComponent(this, Array.from({ length: 21 }, (_, i) => `${21 - i}`), 80, this.getY(1020), this.getY(100));
        this.moneyAmountsTree = new MoneyTreeComponent(this, this.moneyamounts.map((e) => { return `\$ ${e}` }), 240, this.getY(1020), this.getY(100));

        // Can add to scene inside above class, or add them explicitly here (I think I prefer this approach)
        this.add.existing(this.questionNumbersTree);
        this.add.existing(this.moneyAmountsTree);

        // Update the question numbers tree colours
        this.questionNumbersTree.updateSlots('#000000', '#ffffff', '#000000');

        // Groups for envelopes and incorrect answers - makes management easier to treat as a group
        this.envelopeContainer = this.add.container(400, 0).setDepth(10);
        this.correctAnswerContainer = this.add.container(360, 0);
        this.incorrectAnswerContainer = this.add.container(2000, 0).setDepth(1);

        // Create 21 envelopes and add to envelopeGroup - they start in same position as the correctAnswersTree
        // envelope PNG is natively 133px high - so we need to scale it down to fit the tree - use spacingY to determine the scaling
        const spacingY = this.getY(1020 - 100) / 20; // 100 pixels at the top for envelope to sit, 60 pixels at the bottom
        const envelopeScale = spacingY / (133 + 8);
        this.envelopes = [];
        for (let i = 0; i < this.questionData.length; i++) {
            const envelope = this.add.sprite(0, this.getY(100) + i * spacingY, 'envelope');
            envelope.setData('ID', i); // Track which envelope it is
            envelope.setScale(envelopeScale); // Scale down the envelope
            this.envelopes.push(envelope);
            this.envelopeContainer.add(envelope);
        }

    }

    // introQuiz - called when the state is INTRO
    // This is the first state of the FSM, where we set up the initial UI and prepare for the quiz
    // Instructions can be shown here, or a start button can be created
    introQuiz(): void {

        // Build the questions from the data - later this can be pulled from a server
        Phaser.Utils.Array.Shuffle(this.questionData); // Randomly shuffles the array
        this.questions = this.questionData.map((data, idx) => new Question(data, idx));

        this.setupDisplay();

        console.log('introQuiz this:', this.questions);

        // Create a container for the title and instructions
        const introContainer = this.add.container();

        // Display a How to Play title and instructions
        // Space for instructions is between 800 - 1920 pixels wide with 100px padding on the right
        const title = this.add.text(1280, this.getY(100), "How to Play", {
            fontFamily: 'Arial',
            fontSize: '72px',
            color: '#ffffff',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5).setStroke('#000000', 2);

        const oldInstructions: string = "We asked one hundred people 21 questions\n\nWe used their answers to place the questions in order\n\nQuestion 1 (easiest) is worth $1 on the money tree\n\nQuestion 21 (hardest) is worth $250,000\n\nEach question is hidden inside an envelope";
        const newInstructions: string = "We asked one hundred people to answer 21 questions\n\nWe then ranked the question’s difficulty based on their answers\n\nThe questions were then assigned a monetary value\n\n$1 for the easiest question, all the way up to $250,000 for the hardest\n\nFinally, we placed each question into its own unmarked envelope";
        const instructions = this.add.text(720, this.getY(200), newInstructions, {
            fontFamily: 'Arial',
            fontSize: '42px',
            color: '#ffffff',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0, 0);
        instructions.setWordWrapWidth(1920 - 720 - 100); // Set word wrap width to fit the screen

        // Add a 'PLAY' button to start the quiz
        const playButton = this.add.text(1280, instructions.y + instructions.height + this.getY(120), "Continue", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000080',
            padding: { left: 20, right: 20, top: this.getY(10), bottom: this.getY(10) }
        }).setOrigin(0.5)
            .setFontSize(this.getY(48))
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {

                // Trying playing the audio here to see if Safari will play it
                this.sound.play('envelopeshuffle', { volume: 0.5 });
                this.FSM.transitionTo(MoneyTreeState.CHOOSE_ENVELOPE);
            })
            .on('pointerover', () => playButton.setBackgroundColor('#0000ff'))
            .on('pointerout', () => playButton.setBackgroundColor('#000080'));

        introContainer.add([title, instructions, playButton]);

        this.FSM.onNextStateChange(() => {
            introContainer.destroy(true); // Remove the intro container when transitioning to the next state
        });

        // Nothing more to do here for now - move to the next state
        // this.FSM.transitionTo(QuizState.ROUND_START);
    }

    // chooseEnvelope - display further How to Play instructions and let the user choose an envelope
    chooseEnvelope() {
        console.log('MoneyTree:: chooseEnvelope...');

        // This is where we can show the instructions for choosing an envelope
        // Create a container for the title and instructions
        const introContainer = this.add.container();

        // Display a How to Play title and instructions
        // Space for instructions is between 800 - 1920 pixels wide with 100px padding on the right
        const title = this.add.text(1280, this.getY(100), "ROUND 1:", {
            fontFamily: 'Arial',
            color: '#ffffff',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5).setFontSize(this.getY(72));

        const oldInstructions: string = "Firstly, choose an envelope\n\nYou may leave the quiz anytime and walk away with the prize amount for this envelope\n\nYou must answer the question inside the envelope to claim the prize\n\nIt could be $250,000\n\n...or it could be $1\n\nChoose your envelope now...";
        const newInstructions: string = "Choose a random envelope\n\nThis will be your envelope for the final round\n\nIt could be worth $250,000!\n\nClick on your envelope now";
        const instructions = this.add.text(600, this.getY(200), newInstructions, {
            fontFamily: 'Arial',
            color: '#ffffff',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0, 0).setFontSize(this.getY(32));
        instructions.setWordWrapWidth(1920 - 600 - 100); // Set word wrap width to fit the screen

        introContainer.add([title, instructions]);

        this.FSM.onNextStateChange(() => {
            introContainer.destroy(true); // Remove the intro container when transitioning to the next state
        });

        // Clicking one of the envelopes will trigger the next state
        this.envelopes.forEach((envelope) => {
            envelope.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    console.log('Envelope clicked:', envelope.getData('ID'));
                    this.finalQuestion = this.questions[envelope.getData('ID')]; // Get the question object - file away
                    this.finalEnvelope = envelope;
                    envelope.off('pointerdown'); // Remove the pointer event listener
                    envelope.disableInteractive();
                    // remove from container and adjust its position to world coordinates
                    // Get the world transform matrix of the container
                    const matrix = this.envelopeContainer.getWorldTransformMatrix();

                    // Calculate the world position of the sprite
                    const worldX = matrix.tx + envelope.x * matrix.a + envelope.y * matrix.c;
                    const worldY = matrix.ty + envelope.x * matrix.b + envelope.y * matrix.d;
                    this.envelopeContainer.remove(envelope);
                    envelope.setPosition(worldX, worldY); // Set the position to the world coordinates
                    // tween the envelope to move to above the question numbers tree
                    this.tweens.add({
                        targets: envelope,
                        x: 80,
                        y: this.getY(48), // Move it above the question numbers tree
                        duration: 600,
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            this.FSM.transitionTo(MoneyTreeState.INTRO_ROUND);
                        }
                    });
                })
                .on('pointerover', () => envelope.setTint(0xff0000)) // Change tint on hover
                .on('pointerout', () => envelope.clearTint()); // Clear tint on mouse out
        });

        this.shuffleAndArrangeEnvelopes(5);
    }

    shuffleAndArrangeEnvelopes(iteration: number) {
        const centerX = 800 + (1920 - 800) / 2;
        const centerY = this.getY(840);

        console.log('shuffleAndArrangeEnvelopes:', iteration, centerX, centerY);

        // Move the envelope container to the center of the question space
        this.tweens.add({
            targets: this.envelopeContainer,
            x: centerX,
            duration: 500,
            ease: 'Sine.easeInOut',
        });


        const envelopes = this.envelopeContainer.list;
        let remainingCount = envelopes.length;
        envelopes.forEach((envelope) => {
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const distance = Phaser.Math.Between(150, 350);
            const targetX = Math.cos(angle) * distance;
            const targetY = centerY + Math.sin(angle) * distance;

            this.tweens.add({
                targets: envelope,
                x: targetX,
                y: targetY,
                duration: 400,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    remainingCount--;
                    if (remainingCount === 0) {

                        if (iteration > 0) {
                            this.shuffleAndArrangeEnvelopes(iteration - 1);
                        } else {
                            this.arrangeEnvelopesNeatly();
                        }
                    }
                }
            });
        });
    }

    arrangeEnvelopesNeatly() {
        const centerX = 720 + (1920 - 720) / 2;;
        const centerY = this.getY(540);
        const radius: number = this.getY(300);
        const envelopes = this.envelopeContainer.list; // Reference to the envelopes array
        const count = envelopes.length;

        if (envelopes.length === 0) {
            console.log('No envelopes to arrange! Current state:', this.FSM.getState());
            this.FSM.transitionTo(MoneyTreeState.END_ROUND);
            return;
        }

        this.tweens.add({
            targets: this.envelopeContainer,
            x: centerX,
            duration: 300,
            ease: 'Sine.easeInOut',
        });


        // This code taken straight from the function below to ensure that envelopes begin at the correct position
        envelopes.forEach((envelope, i) => {
            const angle = (i / count) * Phaser.Math.PI2;

            // Calculate the new position
            const x = Math.cos(angle) * 300;
            const y = centerY + Math.sin(angle) * radius;

            // Update the envelope's position
            this.tweens.add({
                targets: envelope,
                x: x,
                y: y,
                duration: 300
            });
        });
        // Finally call the rotation function after 300 milliseconds when above tween should complete
        this.time.delayedCall(300, () => {
            this.rotateEnvelopesInCircle(0, centerY, radius, 20000);
        });
    }

    rotateEnvelopesInCircle(centerX: number, centerY: number, radius: number, duration: number = 10000): void {
        const envelopes = this.envelopeContainer.list; // Get all envelopes
        const totalEnvelopes = envelopes.length;

        // Store the initial angle for each envelope
        envelopes.forEach((envelope, index) => {
            envelope.setData('angle', (index / totalEnvelopes) * Phaser.Math.PI2); // Evenly distribute angles
        });

        // Create a tween to rotate the envelopes
        this.tweens.addCounter({
            from: 0,
            to: Phaser.Math.PI2, // Full circle (2π radians)
            duration: duration, // Duration of one full rotation
            repeat: -1, // Infinite loop
            onUpdate: (tween) => {
                const angleOffset = tween.getValue();
                envelopes.forEach((envelope) => {
                    const baseAngle = envelope.getData('angle'); // Get the envelope's base angle
                    const currentAngle = baseAngle + angleOffset; // Add the offset to the base angle

                    // Calculate the new position
                    const x = centerX + Math.cos(currentAngle) * radius;
                    const y = centerY + Math.sin(currentAngle) * radius;

                    // Update the envelope's position
                    (envelope as Phaser.GameObjects.Sprite).setPosition(x, y);

                });
            }
        });
    }

    // introRound - called when the state is ROUND_START
    // This is where we can set up the round, show the money tree, and prepare for the first question
    // If we add more rounds then we probably need a round number to maintain which round we are on
    introRound() {
        console.log('MoneyTree:: startRound...');

        // Move envelopes off the screen to the right to allow players to read the instructions
        this.tweens.killTweensOf(this.envelopeContainer);
        this.tweens.add({
            targets: this.envelopeContainer,
            x: 1920 * 2,
            duration: 600,
            ease: 'Sine.easeIn',
        });

        // We still have a final bit of instructions to add here since we only have one round
        // Create a container for the title and instructions
        const introContainer = this.add.container();

        // Display a How to Play title and instructions
        // Space for instructions is between 800 - 1920 pixels wide with 100px padding on the right
        const title = this.add.text(1280, this.getY(100), "ROUND 2:", {
            fontFamily: 'Arial',
            color: '#ffffff',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5).setFontSize(this.getY(72));

        const oldInstructions: string = "Now answer the remaining questions by selecting envelopes\n\nFor every correct answer:\n\n1. You reveal this question number on the money tree\n2. You win a cash amount based on the hundred people who got this question right\n\nAfter all remaining envelopes have been opened you will be given your final choice\n\nChoose your next envelope to begin...";
        const newInstructions: string = "Now we’ll start helping you figure out what’s in your final envelope!\n\nIn Round 2, you’ll answer the remaining 20 questions. If you answer correctly:\n\n•	We reveal that question’s monetary value\n•	You eliminate that amount from being a possible value of your final envelope\n•	You win cash based on how many of the 100 contestants also answered correctly\n\nIf you answer incorrectly, you receive no information to aid you in the final";
        const instructions = this.add.text(600, this.getY(200), newInstructions, {
            fontFamily: 'Arial',
            color: '#ffffff',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0, 0).setFontSize(this.getY(32));
        instructions.setWordWrapWidth(1920 - 600 - 100); // Set word wrap width to fit the screen

        // Add an 'OK' button to start with the envelopes
        const playButton = this.add.text(1280, instructions.y + instructions.height + this.getY(120), "Continue", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000080',
            padding: { left: 20, right: 20, top: this.getY(10), bottom: this.getY(10) }
        }).setOrigin(0.5)
            .setFontSize(this.getY(48))
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {

                // Trying playing the audio here to see if Safari will play it
                introContainer.destroy(true); // Remove the intro container when transitioning to the next state
                this.activateAllEnvelopes();
            })
            .on('pointerover', () => playButton.setBackgroundColor('#0000ff'))
            .on('pointerout', () => playButton.setBackgroundColor('#000080'));

        introContainer.add([title, instructions, playButton]);

        this.safeCashText = this.add.text(1880, this.getY(1020), "CASH: $", this.labelConfig).setOrigin(1, 0.5)
            .setVisible(false);

        // We don't need this here since we just set up the envelopes ready for the next question
        // this.FSM.onNextStateChange(() => {
        //     introContainer.destroy(true); // Remove the intro container when transitioning to the next state
        // });


        // Nothing more to do here for now - move to the next state
        // this.FSM.transitionTo(QuizState.ROUND_START);
    }

    nextQuestion() {

        console.log('MoneyTree:: nextQuestion...');
        console.log('Current question:', this.currentQuestion);

        // Begin by de-activating and removing the envelopes from the screen
        this.envelopeContainer.list.forEach((envelope) => {
            envelope.disableInteractive();
            envelope.off('pointerdown');
        });
        this.tweens.add({
            targets: this.envelopeContainer,
            x: 1920 * 2,
            duration: 600,
            ease: 'Sine.easeIn',
            onComplete: () => {
                this.showQuestion(this.currentQuestion);
            }
        });

    }

    showQuestion(thisQuestion: Question) {

        console.log('MoneyTree:: showQuestion:', thisQuestion);

        // We are showing a question so play an envelop opening sound
        this.sound.play('envelopeopen', { volume: 0.5 });

        // Build a container for the question and answers - centre everything in this container
        // This version don't attempt to re-use any of the question UI - just destroy and re-create
        const questionContainer = this.add.container(1200, 0);
        const answerTexts: Array<Phaser.GameObjects.Text> = [];

        const panelY = this.getY(100);
        const panelWidth = 1200;
        const panelHeight = this.getY(300);

        // Gold rounded rectangle background
        const panel = this.make.nineslice({
            x: 0,
            y: panelY,
            key: 'borderbox',
            width: panelWidth,
            height: panelHeight,
            leftWidth: 12,
            rightWidth: 12,
            topHeight: 12,
            bottomHeight: 12,
            origin: { x: 0.5, y: 0 },
            add: true
        });

        // Question text - vertically centred (origin 0, 0.5)
        const questionText = this.add.text(0, panelY + panelHeight / 2, thisQuestion.question);
        questionText.setFontFamily('Arial')
            .setFontSize(this.getY(40))
            .setColor('#ffffcc')
            .setWordWrapWidth(panelWidth - 80)
            .setOrigin(0.5);

        questionContainer.add([panel, questionText]);

        // Answers (up to 4)
        const answerStartY = panelY + panelHeight + this.getY(120); // space below question

        thisQuestion.answers.forEach((answer, idx) => {
            const btn: Phaser.GameObjects.Text = this.add.text(0, answerStartY + this.getY(idx * 100), answer, {
                fontFamily: 'Arial',
                color: '#ffffff',
                padding: { left: 40, right: 40, top: this.getY(10), bottom: this.getY(10) }
            }).setOrigin(0.5)
                .setFontSize(this.getY(40))
                .setBackgroundColor('#5555a0')
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    this.currentQuestion.selectedAnswerIndex = idx;
                    checkAnswer(idx);
                })
                .on('pointerover', () => btn.setBackgroundColor('#8888FF'))
                .on('pointerout', () => btn.setBackgroundColor('#5555a0'));

            answerTexts.push(btn);
            questionContainer.add(btn);
        });

        // Inline function for displaying the right/wrong message and pausing before clearing away
        // This architecture allows function to clean up after itself - next state can create its own UI
        const checkAnswer = (selectedAnswer: number) => {
            const correct: boolean = selectedAnswer === thisQuestion.correct;
            questionText.text = correct ? "Correct!" : "Incorrect :(";
            questionText.setColor(correct ? '#00ff00' : '#ff0000');
            questionText.setFontSize(this.getY(48));
            if (correct) {
                this.sound.play('answercorrect', { volume: 0.5 });
            } else {
                this.sound.play('answerincorrect', { volume: 0.5 });
            }
            this.time.delayedCall(1000, () => {

                // We arrive here either during regular questions or when gambling for the final question
                // UPDATE: we can't arrive here from final question but keep this code here in case we want to revert
                // UPDATE: since we have added the ALLIN state we can re-use the code...
                if (this.FSM.getState() === MoneyTreeState.GAMBLE) {
                    this.FSM.transitionTo(correct ? MoneyTreeState.GAMBLE_WON : MoneyTreeState.GAMBLE_LOST);
                } else if (this.FSM.getState() === MoneyTreeState.ALLIN) {
                    this.FSM.transitionTo(correct ? MoneyTreeState.ALLIN_WON : MoneyTreeState.ALLIN_LOST);
                } else {
                    this.FSM.transitionTo(MoneyTreeState.ANSWER);
                }
            });
        }

        // Clicking one of the answers will trigger the next state
        // Destroy the question container when transitioning to the next state
        this.FSM.onNextStateChange(() => {
            questionContainer.destroy(true); // Remove the question container when transitioning to the next state
        });

    }

    showAnswer(): void {

        console.log('MoneyTree:: handleAnswer:', this.currentQuestion);

        // Create a 'short' question to add to either the incorrect or the correct container
        const questionText = this.add.text(0, -100, this.currentQuestion.question)
            .setFontFamily('Arial')
            .setBackgroundColor('#111111')
            .setColor('#bbbbbb')
            .setPadding({ left: 40, right: 40, top: this.getY(3), bottom: this.getY(3) })
            .setOrigin(0, 0.5)
            .setFontSize(this.getY(32))
            ;

        // Function callback after animation has completed to place the answer in the correct location
        // and update the other two money trees
        const placeAnswer = () => {
            this.questionNumbersTree.setSlotState(this.currentQuestion.questionIndex, 'revealed');
            this.moneyAmountsTree.setSlotState(this.currentQuestion.questionIndex, 'revealed');
            const slotY = this.questionNumbersTree.getSlotByIndex(this.currentQuestion.questionIndex).y;
            this.correctAnswerContainer.add(questionText);
            questionText.setPosition(0, slotY);

            const newCash: number = this.safeCash + (this.currentQuestion.questionIndex + 1) * 75;
            this.tweens.add({
                targets: { value: this.safeCash }, // Create an object with the variable to tween
                value: newCash, // The target value
                duration: 1500, // Duration in milliseconds (2 seconds)
                ease: 'Linear', // Easing function
                onUpdate: (tween) => {
                    const currentValue: number | null = tween.getValue();
                    this.safeCash = Math.round(currentValue || 0);
                    this.safeCashText.setText(`CASH: $ ${this.safeCash}`).setVisible(true);
                },
                onComplete: () => {
                    console.log('Cash tween complete:', this.safeCash);
                }
            });

            this.allinCash = this.allinCash + (this.moneyamounts[this.currentQuestion.questionIndex]);
            // This call ends the ANSWER round and sets up the envelopes ready for the next question
            this.activateAllEnvelopes();
        }

        if (this.currentQuestion.selectedAnswerIndex === this.currentQuestion.correct) {
            this.moneyAmountsTree.animateCorrectAnswer(this.currentQuestion.questionIndex, placeAnswer);
        } else {
            this.incorrectAnswerContainer.add(questionText);
            this.arrangeIncorrectAnswers();
            this.activateAllEnvelopes();
        }

    }


    activateAllEnvelopes() {

        this.arrangeEnvelopesNeatly(); // Arrange envelopes neatly

        this.envelopeContainer.list.forEach((envelope) => {
            envelope.removeAllListeners();
            envelope.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    console.log('Envelope clicked:', envelope.getData('ID'));
                    this.currentQuestion = this.questions[envelope.getData('ID')]; // Get the question object

                    // Clean up this envelope - no longer needed
                    this.envelopeContainer.remove(envelope); // Remove the envelope from the container
                    envelope.off('pointerdown'); // Remove the pointer event listener
                    envelope.destroy(); // Destroy the envelope after the animation
                    this.FSM.transitionTo(MoneyTreeState.QUESTION);
                })
                .on('pointerover', () => (envelope as Phaser.GameObjects.Sprite).setTint(0xff0000)) // Change tint on hover
                .on('pointerout', () => (envelope as Phaser.GameObjects.Sprite).clearTint()); // Clear tint on mouse out
        });
    }

    endRound() {
        console.log('MoneyTree:: END_ROUND');

        // Special case - since there is possibly quite a lot of text on the screen and more instructions
        // Slide the questions off the screen and bring them back on at the end of this state
        this.correctAnswerContainer.y = this.getY(2000);

        const introContainer = this.add.container();

        // Display a How to Play title and instructions
        // Space for instructions is between 800 - 1920 pixels wide with 100px padding on the right
        const title = this.add.text(1280, this.getY(100), "YOUR FINAL CHOICE...", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5).setFontSize(this.getY(60));

        const instructions = this.add.text(600, this.getY(200), "Congratulations - you have made it to the end! Almost...\n\nYou have one final choice to make\n\nDo you want to KEEP the cash you’ve won so far?\nOr GAMBLE it all by opening your 'Final' envelope and hopefully winning a greater prize?\nOr go ALL-IN and attempt to walk away with the JACKPOT?\n\nIf you PLAY SAFE you walk away with your cash\nIf you GAMBLE you take home what's in the envelope\nIf you go ALL-IN you could win the value of all the questions you answered correctly\n\nYou can review all your wrong answers to try and work out whats in the envelope\n\n", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { left: 60, right: 60, top: this.getY(20), bottom: this.getY(20) }
        })
            .setOrigin(0, 0)
            .setFontSize(this.getY(32))
            .setWordWrapWidth(1920 - 600 - 100);

        // Add a button to move on
        const playButton = this.add.text(1280, instructions.y + instructions.height + this.getY(60), "I'M READY", {
            fontFamily: 'Arial',
            fontSize: '48px',
            color: '#ffffff',
            backgroundColor: '#5555a0',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.FSM.transitionTo(MoneyTreeState.FINAL_CHOICE);
            })
            .on('pointerover', () => playButton.setBackgroundColor('#8888FF'))
            .on('pointerout', () => playButton.setBackgroundColor('#5555a0'));

        const psnote = this.add.text(600, playButton.y + this.getY(60), "* we know you're not playing for money right now, but please try to make your choice based on what you think you really would do! Thanks :)")
            .setOrigin(0, 0)
            .setFontSize(this.getY(32))
            .setWordWrapWidth(1920 - 600 - 100);
        ;

        introContainer.add([title, instructions, playButton, psnote]);

        this.FSM.onNextStateChange(() => {
            this.correctAnswerContainer.y = 0;
            introContainer.destroy(true); // Remove the intro container when transitioning to the next state
        });

    }

    finalChoice() {
        console.log('MoneyTree:: Final Choice...');

        console.log(this.moneyAmountsTree.getAllSlots());

        // Since the final question can not be selected by clicking on the envelope
        // just set the currentQuestion to the previously stored finalQuestion
        this.currentQuestion = this.finalQuestion;

        const introContainer = this.add.container().setDepth(10);

        // Display a How to Play title and instructions
        // Space for instructions is between 800 - 1920 pixels wide with 100px padding on the right
        const title = this.add.text(1280, this.getY(100), "YOUR FINAL CHOICE...", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5).setFontSize(this.getY(60)).setVisible(false);

        const instructions = this.add.text(600, this.getY(200), "* we know you're not playing for money right now, but please try to make your choice based on what you think you really would do! Thanks :)", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        })
            .setOrigin(0, 0)
            .setFontSize(this.getY(32))
            .setWordWrapWidth(1920 - 600 - 60)
            .setVisible(false)
            ;

        // this.incorrectAnswerContainer.setY(instructions.y + instructions.height + this.getY(60)); // Move the incorrect answer container below the instructions
        // this.tweens.add({
        //     targets: this.incorrectAnswerContainer,
        //     x: 1280, // Move it to the left side of the screen
        //     duration: 300,
        //     ease: 'Sine.easeInOut',
        // });

        // Add a 'SAFE' and a 'GAMBLE' button
        const minY: number = Math.min(instructions.y + instructions.height + this.getY(280), this.getY(840))
        const safeButton = this.add.text(600, minY, "SAFE", {
            fontFamily: 'Arial',
            color: '#000000',
            backgroundColor: '#a0a000',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5)
            .setFontSize(this.getY(72))
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.FSM.transitionTo(MoneyTreeState.PLAY_SAFE);
            })
            .on('pointerover', () => safeButton.setBackgroundColor('#ffff00'))
            .on('pointerout', () => safeButton.setBackgroundColor('#a0a000'));

        // Place the cash and the final envelope below the buttons to re-inforce the decision
        this.tweens.add({
            targets: this.safeCashText,
            x: 600,
            y: safeButton.y + this.getY(120),
            duration: 500
        });
        this.safeCashText.text = `$ ${this.safeCash}`;
        this.safeCashText.setOrigin(0.5, 0.5);

        const gambleButton = this.add.text(1100, minY, "GAMBLE", {
            fontFamily: 'Arial',
            color: '#000000',
            backgroundColor: '#a00000',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5)
            .setFontSize(this.getY(72))
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.FSM.transitionTo(MoneyTreeState.GAMBLE);
            })
            .on('pointerover', () => gambleButton.setBackgroundColor('#ff0000'))
            .on('pointerout', () => gambleButton.setBackgroundColor('#a00000'));

        this.tweens.add({
            targets: this.finalEnvelope,
            x: gambleButton.x,
            y: gambleButton.y + this.getY(120),
            duration: 500
        });
        const envelopeScale: number = this.getY(60) / 133;
        this.finalEnvelope.setScale(envelopeScale);

        const allinButton = this.add.text(1600, minY, "ALL-IN", {
            fontFamily: 'Arial',
            color: '#FFFFFF',
            backgroundColor: '#0000A0',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5)
            .setFontSize(this.getY(72))
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.FSM.transitionTo(MoneyTreeState.ALLIN);
            })
            .on('pointerover', () => allinButton.setBackgroundColor('#0000FF'))
            .on('pointerout', () => allinButton.setBackgroundColor('#0000A0'));

        const allinConfig = Object.assign({}, this.labelConfig, { color: "#0000FF" });
        this.allinCashText = this.add.text(1600, safeButton.y + this.getY(120), `$ 0`, allinConfig)
            .setOrigin(0.5, 0.5)
            .setVisible(true);
        let allinCash: number = 0;
        this.tweens.add({
            targets: { value: allinCash }, // Create an object with the variable to tween
            value: this.allinCash, // The target value
            duration: 1500, // Duration in milliseconds (2 seconds)
            ease: 'Linear', // Easing function
            onUpdate: (tween) => {
                const currentValue: number | null = tween.getValue();
                allinCash = Math.round(currentValue || 0);
                this.allinCashText.setText(`$ ${allinCash}`).setVisible(true);
            },
            onComplete: () => {
                console.log('All In cash tween complete:', this.allinCash);
            }
        });


        introContainer.add([title, instructions, safeButton, gambleButton, this.safeCashText, this.finalEnvelope, allinButton, this.allinCashText]);

        this.FSM.onNextStateChange(() => {
            this.incorrectAnswerContainer.setX(2000); // Move the incorrect answer container off-screen
            introContainer.destroy(true); // Remove the intro container when transitioning to the next state
        });

    }

    playSafe(): void {

        console.log('MoneyTree:: playSafe...');

        this.finalDecision = 'SAFE';

        const introContainer = this.add.container();

        // Display a How to Play title and instructions
        // Space for instructions is between 800 - 1920 pixels wide with 100px padding on the right
        const title = this.add.text(1280, this.getY(100), "PLAY SAFE!", {
            fontFamily: 'Arial',
            fontSize: '72px',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5).setStroke('#000000', 2);

        const instructions = this.add.text(720, this.getY(200), `You played safe and walked away with $${this.safeCash} !\n\nLet's take a look at what you might have won...`, {
            fontFamily: 'Arial',
            fontSize: '42px',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0, 0).setStroke('#000000', 2);
        instructions.setWordWrapWidth(1920 - 720 - 100); // Set word wrap width to fit the screen

        introContainer.add([title, instructions]);

        this.FSM.onNextStateChange(() => {
            introContainer.destroy(true); // Remove the intro container when transitioning to the next state
        });

        this.moneyAmountsTree.animateCorrectAnswer(this.currentQuestion.questionIndex, () => {
            console.log('MoneyTree:: playSafe - animation complete...');
            this.FSM.transitionTo(MoneyTreeState.END_QUIZ);
        });
    }

    checkEnvelope(): void {
        console.log('MoneyTree:: checkEnvelope...');

        this.moneyAmountsTree.animateCorrectAnswer(this.currentQuestion.questionIndex, () => {
            console.log('MoneyTree:: checkEnvelope - animation complete...');
            this.FSM.transitionTo(MoneyTreeState.END_QUIZ); // Move to the end of the quiz
        }); // Animate the correct answer on the money tree
    }

    gamble(): void {

        console.log('MoneyTree:: gamble...');

        // UPDATE: we no longer show the question again - just go straight to the gamble result
        // Treat as if gamble was won since they don't have to answer the question to win the money
        // this.showQuestion(this.currentQuestion); // Ask the final question
        this.finalDecision = 'GAMBLE';
        this.FSM.transitionTo(MoneyTreeState.GAMBLE_WON);
    }
    gambleWon(): void {

        this.finalDecision = 'GAMBLE - WON';

        this.moneyAmountsTree.animateCorrectAnswer(this.currentQuestion.questionIndex, () => {
            this.gambleWonMessage(); // Show the message for winning the gamble
        });
    }
    gambleWonMessage(): void {

        const answerIndex: number = this.currentQuestion.questionIndex;
        const moneyWon: number = this.moneyamounts[answerIndex]; // Get the money amount from the question index

        console.log('MoneyTree:: gambleWon...:', answerIndex, moneyWon);

        // Create a container for text and final comments - fill with text afterwads based on result
        const finalContainer = this.add.container().setDepth(10);
        const finalTitle = this.add.text(1280, this.getY(100), "", {
            fontFamily: 'Arial',
            fontSize: '72px',
            color: '#ffffff',
            backgroundColor: '#000000',
        }).setOrigin(0.5).setStroke('#000000', 2);
        const finalText = this.add.text(720, this.getY(160), "", {
            fontFamily: 'Arial',
            fontSize: '42px',
            color: '#ffffff',
            backgroundColor: '#000000',
        })
        .setOrigin(0, 0)
        .setWordWrapWidth(1920 - 720 - 100);
        if (moneyWon > (this.safeCash * 2)) {
            finalTitle.setText("WOW!");
            finalText.setText(`You took the gamble and you've won $${moneyWon}!\n\nIf you had played safe you would have walked away with $${this.safeCash}\n\nGreat result! Well played :)`);
        } else if (moneyWon > this.safeCash) {
            finalTitle.setText("GOOD CHOICE!");
            finalText.setText(`You took the gamble and you've won $${moneyWon}!\n\nYou could have played safe and only walked away with $${this.safeCash} but you made the right choice!`);
        } else {
            finalTitle.setText("OUCH :(");
            finalText.setText(`You took the gamble and you've won $${moneyWon}!\n\nYou could have played safe and walked away with $${this.safeCash}...:(\n\nOh well - better luck next time!`);
        }


        // Add a 'DONE' button to move to the final state
        const doneButton = this.add.text(1280, finalText.y + finalText.height + this.getY(160), "OK", {
            fontFamily: 'Arial',
            fontSize: '48px',
            color: '#ffffff',
            backgroundColor: '#000080',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.FSM.transitionTo(MoneyTreeState.END_QUIZ);
            })
            .on('pointerover', () => doneButton.setBackgroundColor('#0000ff'))
            .on('pointerout', () => doneButton.setBackgroundColor('#000080'));

        finalContainer.add([finalTitle, finalText, doneButton]);

        this.FSM.onNextStateChange(() => {
            finalContainer.destroy(true); // Remove the final container when transitioning to the next state
        });
    }
    gambleLost(): void {
        console.log('MoneyTree:: gambleLost...');

        this.finalDecision = 'GAMBLE - LOST';

        const questionIndex: number = this.currentQuestion.questionIndex;
        const moneyWon: number = this.moneyamounts[questionIndex];

        // Create a container for text and final comments - fill with text afterwads based on result
        const finalContainer = this.add.container().setDepth(10);
        const finalTitle = this.add.text(1280, this.getY(100), "", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
        }).setOrigin(0.5).setFontSize(this.getY(72));
        const finalText = this.add.text(720, this.getY(200), "", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { left: 60, right: 60, top: this.getY(10), bottom: this.getY(10) }
        }).setOrigin(0, 0).setFontSize(this.getY(42));
        finalText.setWordWrapWidth(1920 - 720 - 100);

        finalTitle.setText("OH DEAR...");
        finalText.setText(`You took the gamble and lost out on your BIG money prize... :(\n\nLet's see how much you would have won...`);

        finalContainer.add([finalTitle, finalText]);


        this.moneyAmountsTree.animateCorrectAnswer(questionIndex, () => {
            this.FSM.transitionTo(MoneyTreeState.END_QUIZ);
        });

        this.FSM.onNextStateChange(() => {
            finalContainer.destroy(true); // Remove the final container when transitioning to the next state
        });

    }

    allin(): void {
        console.log('MoneyTree:: allin...');
        this.finalDecision = 'ALL IN';

        this.envelopeContainer.list.forEach((envelope) => {
            envelope.disableInteractive();
            envelope.off('pointerdown');
        });
        this.tweens.add({
            targets: this.envelopeContainer,
            x: 1920 * 2,
            duration: 600,
            ease: 'Sine.easeIn',
            onComplete: () => {
                this.showQuestion(this.allinQuestion);
            }
        });
    }

    allinWon(): void {
        console.log('MoneyTree:: allinWon...');
        this.finalDecision = 'ALL IN - WON';

        // This code copied from gambleWonMessage
        console.log('MoneyTree:: AllInWon...:', this.allinCash);

        // Create a container for text and final comments - fill with text afterwads based on result
        const finalContainer = this.add.container().setDepth(10);
        const finalTitle = this.add.text(1280, this.getY(100), "", {
            fontFamily: 'Arial',
            fontSize: '72px',
            color: '#ffffff',
            backgroundColor: '#000000',
        }).setOrigin(0.5).setStroke('#000000', 2);
        const finalText = this.add.text(720, this.getY(160), "", {
            fontFamily: 'Arial',
            fontSize: '42px',
            color: '#ffffff',
            backgroundColor: '#000000',
        }).setOrigin(0, 0).setWordWrapWidth(1920 - 720 - 100);
        finalTitle.setText("WOW!");
        finalText.setText(`You took the ultimate ALL-IN gamble and you've won $${this.allinCash}!\n\nIf you had played safe you would have walked away with $${this.safeCash}\n\nGreat result! Well played :)`);

        // Add a 'DONE' button to move to the final state
        const doneButton = this.add.text(1280, finalText.y + finalText.height + this.getY(160), "OK", {
            fontFamily: 'Arial',
            fontSize: '48px',
            color: '#ffffff',
            backgroundColor: '#000080',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.FSM.transitionTo(MoneyTreeState.END_QUIZ);
            })
            .on('pointerover', () => doneButton.setBackgroundColor('#0000ff'))
            .on('pointerout', () => doneButton.setBackgroundColor('#000080'));

        finalContainer.add([finalTitle, finalText, doneButton]);

        this.FSM.onNextStateChange(() => {
            finalContainer.destroy(true); // Remove the final container when transitioning to the next state
        });

    }
    allinLost(): void {
        console.log('MoneyTree:: allinLost...');
        this.finalDecision = 'ALL IN - LOST';

        const finalContainer = this.add.container().setDepth(10);
        const finalTitle = this.add.text(1280, this.getY(100), "", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
        }).setOrigin(0.5).setFontSize(this.getY(72));
        const finalText = this.add.text(720, this.getY(200), "", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { left: 60, right: 60, top: this.getY(10), bottom: this.getY(10) }
        }).setOrigin(0, 0).setFontSize(this.getY(42));
        finalText.setWordWrapWidth(1920 - 720 - 100);

        finalTitle.setText("OH DEAR...");
        finalText.setText(`You took the ultimate ALL-IN gamble and lost out on the BIG money prize... :(\n\nLets see what you would have won if you'd chosen the envelope`);

        const questionIndex: number = this.currentQuestion.questionIndex;
        this.moneyAmountsTree.animateCorrectAnswer(questionIndex, () => {
            this.FSM.transitionTo(MoneyTreeState.END_QUIZ);
        });


        finalContainer.add([finalTitle, finalText]);

        this.FSM.onNextStateChange(() => {
            finalContainer.destroy(true); // Remove the final container when transitioning to the next state
        });
    }

    endQuiz() {
        console.log('MoneyTree:: endQuiz...');
        // This is where we can show the final results of the quiz, or move to the main menu

        const answerIndex: number = this.currentQuestion.questionIndex;
        const moneyAmount: number = this.moneyamounts[answerIndex]; // Get the money amount from the question index

        this.correctAnswerContainer.x = 2000;

        console.log(this.questions);
        console.log('Final decision:', this.finalDecision);
        console.log('Safe cash amount:', this.safeCash);
        console.log('Gamble amount:', moneyAmount);

        // Create a container for text and final comments - fill with text afterwads based on result
        const finalContainer = this.add.container().setDepth(10);
        const finalTitle = this.add.text(1280, this.getY(100), "Thanks for playing!", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
        }).setOrigin(0.5).setFontSize(this.getY(60));
        const finalText = this.add.text(720, this.getY(160), "", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
        }).setOrigin(0, 0).setFontSize(this.getY(40));
        finalText.setWordWrapWidth(1920 - 720 - 100); // Set word wrap width to fit the screen

        // if (moneyAmount > (this.safeCash * 2)) {
        //     finalTitle.setText("WOW!");
        //     finalText.setText(`You answered the question correctly and won $${moneyAmount}!\n\nIf you had played safe you would have walked away with $${this.safeCash}\n\nGreat result! Well played :)`);
        // } else if (moneyAmount > this.safeCash) {
        //     finalTitle.setText("GOOD CHOICE!");
        //     finalText.setText(`You answered the question correctly and won $${moneyAmount}!\n\nYou could have played safe and only walked away with $${this.safeCash} but you made the right choice!`);
        // } else if (moneyAmount < this.safeCash / 2) {
        //     finalTitle.setText("OUCH :(");
        //     finalText.setText(`You answered the question correctly but only won $${moneyAmount}!\n\nYou could have played safe and walked away with $${this.safeCash}...:(\n\nOh well - better luck next time!`);
        // } else {
        //     finalTitle.setText("OH DEAR...");
        //     finalText.setText(`You answered the question correctly and won $${moneyAmount}!\n\nYou could have played safe and walked away with $${this.safeCash} but you made the right choice!`);
        // }

        if (this.finalDecision == 'SAFE') {
            finalText.setText("One last question: looking at the money tree, how low would the SAFE cash amount have needed to be for you to choose to GAMBLE?");
        } else {
            finalText.setText("One last question: looking at the money tree, how high would the SAFE cash amount have needed to be for you to choose to PLAY SAFE?");
        }


        const maxSafeCash: number = 50000;
        const sliderX: number = 720;
        const sliderY: number = finalText.y + finalText.height + this.getY(64);
        const sliderWidth: number = 1920 - 720 - 100;
        const sliderHeight: number = 24;

        const cashTextX: number = sliderX + (this.safeCash / maxSafeCash) * sliderWidth;
        const cashText = this.add.text(cashTextX, sliderY + this.getY(64), `$ ${this.safeCash}`)
            .setOrigin(0.5)
            .setFontSize(this.getY(32))
            .setFontFamily('Arial')
            ;

        // Gold rounded rectangle background
        const bar = this.make.nineslice({
            x: sliderX,
            y: sliderY,
            key: 'borderbox',
            width: sliderWidth,
            height: sliderHeight,
            leftWidth: 12,
            rightWidth: 12,
            topHeight: 12,
            bottomHeight: 12,
            origin: { x: 0, y: 0.5 },
            add: true
        });
        const slider = this.make.nineslice({
            x: cashTextX,
            y: sliderY,
            key: 'borderbox',
            width: 24,
            height: 64,
            leftWidth: 12,
            rightWidth: 12,
            topHeight: 12,
            bottomHeight: 12,
            origin: { x: 0.5, y: 0.5 },
            add: true
        });

        slider.setInteractive(new Phaser.Geom.Rectangle(0, 0, 24, 64), Phaser.Geom.Rectangle.Contains);

        // Enable dragging
        this.input.setDraggable(slider);

        var cashAmount: number = this.safeCash;

        this.input.on("drag", (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number) => {
            if (gameObject === slider) {
                const newX: number = Phaser.Math.Clamp(dragX, sliderX, 1820);
                const rangeX: number = (newX - sliderX) / sliderWidth;
                cashAmount = Math.round(100 * rangeX) * maxSafeCash / 100;
                cashText.setText(`$ ${cashAmount}`);
                cashText.x = newX;
                slider.x = newX;
            }
        });

        // Add a 'DONE' button to move to the final state
        const doneButton = this.add.text(1280, finalText.y + finalText.height + this.getY(360), "OK", {
            fontFamily: 'Arial',
            fontSize: '48px',
            color: '#ffffff',
            backgroundColor: '#000080',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.thresholdAmount = cashAmount;
                this.FSM.transitionTo(MoneyTreeState.SAVE_RESULTS);
            })
            .on('pointerover', () => doneButton.setBackgroundColor('#0000ff'))
            .on('pointerout', () => doneButton.setBackgroundColor('#000080'));

        finalContainer.add([finalTitle, finalText, doneButton, cashText, bar, slider]);

        this.FSM.onNextStateChange(() => {
            finalContainer.destroy(true); // Remove the final container when transitioning to the next state
        });
    }

    saveResults(): void {
        const answerIndex: number = this.currentQuestion.questionIndex;
        const moneyAmount: number = this.moneyamounts[answerIndex]; // Get the money amount from the question index

        console.log(this.questions);

        var questionsAnswered: number = this.questions.filter((question) => { return question.selectedAnswerIndex !== -1 }).length;
        var questionsCorrect: number = this.questions.filter((question) => { return question.selectedAnswerIndex == question.correct }).length;
        if (this.finalDecision == 'SAFE') {
            // no need to adjust above numbers
        } else {
            questionsAnswered -= 1;
            if (this.finalDecision == 'GAMBLE - WON') {
                questionsCorrect -= 1;
            }
        }

        // Build a results string showing correct (X) and incorrect (.) questions by monetary value
        // Sort questions by their questionIndex (which corresponds to monetary value)
        const sortedQuestions = [...this.questions].sort((a, b) => a.questionIndex - b.questionIndex);

        // Generate the results string - X for correct, . for incorrect/unanswered
        let resultsString = '';
        sortedQuestions.forEach(question => {
            // Skip the final question if it was used for gambling
            if (question.questionIndex === this.finalQuestion.questionIndex) {
                resultsString += 'G'; // Mark the gambled question
            } else if (question.selectedAnswerIndex === question.correct) {
                resultsString += 'X'; // Correct answer
            } else {
                resultsString += '.'; // Incorrect or unanswered
            }
        });


        console.log('Questions answered:', questionsAnswered);
        console.log('Questions correct:', questionsCorrect);
        console.log('Final decision:', this.finalDecision);
        console.log('Safe cash amount:', this.safeCash);
        console.log('Gamble amount:', moneyAmount);
        console.log('Threhold amount:', this.thresholdAmount);
        console.log('Results:', resultsString);

        this.socket.emit('client:saveresults', `${questionsAnswered}\t${questionsCorrect}\t${this.safeCash}\t${moneyAmount}\t${this.thresholdAmount}\t${this.finalDecision}\t${resultsString}`);

        // Create a container for text and final comments - fill with text afterwads based on result
        const finalContainer = this.add.container().setDepth(10);
        const finalTitle = this.add.text(1280, this.getY(100), "Thanks for playing!", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
        }).setOrigin(0.5).setFontSize(this.getY(60));

        const finalText = this.add.text(720, this.getY(160), "", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
        }).setOrigin(0, 0).setFontSize(this.getY(40));
        finalText.setWordWrapWidth(1920 - 720 - 100); // Set word wrap width to fit the screen

        finalText.setText(`Answered correctly: ${questionsCorrect} out of ${questionsAnswered}\nSafe cash: $ ${this.safeCash}\nMoneytree prize: $ ${moneyAmount}\nAll-In Amount: ${this.allinCash}\n\nClick 'PLAY AGAIN' if you'd like to try with a different set of questions`);

        const doneButton = this.add.text(1280, finalText.y + finalText.height + this.getY(360), "PLAY AGAIN", {
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000080',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5)
            .setFontSize(this.getY(48))
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.FSM.transitionTo(MoneyTreeState.SPLASH);
            })
            .on('pointerover', () => doneButton.setBackgroundColor('#0000ff'))
            .on('pointerout', () => doneButton.setBackgroundColor('#000080'));

        finalContainer.add([finalTitle, finalText, doneButton]);

        this.FSM.onNextStateChange(() => {
            finalContainer.destroy(true); // Remove the final container when transitioning to the next state
        });

    }


    // This function is not needed but has to be included due to the BaseScene class
    getPlayerBySessionID(sessionID: string): Phaser.GameObjects.Container {
        return this.add.container(0, 0);
    }

    arrangeIncorrectAnswers(): void {

        // Arrange the incorrect answers in a vertical list
        const incorrectAnswers = this.incorrectAnswerContainer.list;
        const spacingY = this.getY(48);
        incorrectAnswers.forEach((answer, i) => {
            const textAnswer = answer as Phaser.GameObjects.Text;
            const targetY = i * spacingY;
            textAnswer.setY(targetY);
        });

    }

    sceneShutdown(): void {
        console.log('MoneyTree:: sceneShutdown...');
    }
}


const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    scale: {
        mode: Phaser.Scale.RESIZE
    },
    plugins: {
        global: [
            {
                key: 'SocketManagerPlugin',
                plugin: SocketManagerPlugin,
                start: false
            },
            {
                key: 'rexWebFontLoader',
                plugin: WebFontLoaderPlugin,
                start: true
            }
        ]
    },
    scene: MoneyTreeScene,
    parent: 'container'
};


// Extend the Window interface to include PhaserGameInstance
declare global {
    interface Window {
        PhaserGameInstance?: Phaser.Game;
    }
}
if (!('PhaserGameInstance' in window)) {
    const game = new Phaser.Game(config);
    console.log('Standalone MoneyTree game created:', game);
    // Extend the Window interface to include PhaserGameInstance
    interface Window {
        PhaserGameInstance?: Phaser.Game;
    }
    window.PhaserGameInstance = game; // Store the game instance globally to avoid conflicts
}
