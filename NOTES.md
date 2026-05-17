A place to dump random thoughts as they come to me during development
Log the results of experimentation so I don't end up making decisions and then changing
Document what I'm doing so I can remember later why I did things the way they are...

Layout, Positioning and Scaling
Could become a big topic to try to make sure it always looks good on all sizes and ratios.
BUT design around a basic 16:9 display as this is the most likely.
Assume this is or something close to this.
In which case I mainly need to make sure I'm using the screen size usefully.

I experimented with having a container which scales to fit as close as possible and then an offset to centre the container in the viewport
BUT this has the problem og having part of the screen unused (the borders) which I don't like.
Better to determine a scale to have control over the size of assets eg player objects
And then use the full screen size (window.innerWidth/Height) to lay out the elements.

Also fiddled around with creating containers to hold eg the players, the other elements to allow scaling of all players in one go
BUT this causes problems with having to adjust the positions to allow for the scale factor.

In the end went for the simplest approach! All positioning is done using a logical canvas (1920,1080)
which is always scaled to suit the viewport size.
This allows direct control of placement in the window accurately
IF I decide that players should be scaled they will have their own scale set individually - this does NOT affect positioning
Maybe when players become dead they will be scaled - but this is done on the player NOT the container.
This is very straight-forward and should work.

Place players into different containers purely for ease of management, and to easily add tweens to JUST the living players
Also continers allows the entire container to have a z-index which gives priority to entire collection
ALL lviing players can go over all dead players which go above background icons etc

Experimented with creating separate classes to handle different parts of the system. More work required here. Unfinished but drive forward with the prototype
Next up really get the collection of votes in the night and day states.
Start with the basic voting system, add other forms of voting (much) later...

Room class created which manages each room.
Key thing was understanding how the event listeners (socket.on) work - to make sure the correct scope is applied.
Important is to use an arrow function => which allows the function to receive the Room class in the 'this' scope

Next step will be to separate out the Game elements into a separate Game class
This way each Game (Werewolves, Quiz) will have its own class and the Room class provides the low-level socket management for the room.

Still haven't attempted the more complex voting structure eg chain-saving but basic voting works.
Also haven't tried adding a timeout to this part, that's a TODO.

Update: created a pretty robust system for asynchronous collection of player input and host display of messages
Thanks for copilot for that - good suggestions

Got a working demo with a collection of characters (wolves, witch, healer, seer)

TODO:
More characters
Show who voted for who - difficult - display must cater for wide variety of possible vote results, and handle draws
Other ways of voting (secret vote, chain-save, instant death, ...) - see later
Tidy up design and battle-harden for production - more testing needed
Consider other ways that it could break - ways for admin to interrupt flow and take control (eg kill people, bring people to life etc)

Streamline events and display to make a set of 'generic' events that can be used by many games.
Simplify the wolf game so 'generic' events are used where possible

Separate out Wolf game from Room code: Room should just manage users and socket events, passing to Game class for ALL game logic
Consider best way to separate concerns and allow other games to be loaded/played instead of werewolves

Build a flexible layout system which manages the display elements and ensures they always look good whatever the screen dimensions
Note on this: setting the X coord of an element works just using 1920px width - the BODY scale takes care of it.
BUT querying the position of an element gives the 'real' value not the scaled value. Need to investigate this further but getting the clientBoundingBox for example seems to return the screen coord NOT the canvas coord.
More research needed here to ensure accurate positioning and laying out of elements...

Game Options:
Flexible way to display a panel on the host screen listing all the game options, with defaults, and allow the user to customise their game
Game settings likely needs a set of components, checkbox, sliders, ordered lists, radio buttons, info text to explain options, pane views to separate out different option groups
JSON schema to define the options for a game - options then stored as a JSON following the schema
Ultimately the user's game options should be stored so next time they play they can re-use the same custom set-up
After that, they could save different versions of the game for easy recall - but this can come much later.

Selectable games - create a LOBBY which just displays logged-in players, and a list of games host can choose from.
Selecting a game brings up the info on the game, maybe a tutorial video or animation, host can select PLAY which will bring up the options screen - choose options then hit PLAY.



Other ways of voting:
These are all versions of putting a 'question' to a client or clients, collecting some kind of response.
Regardless of the type of question (this could vary, especially for a quiz) the type of collection (voting) system varies
All systems should work with one or more clients - all results are collected within specified time period, if everyone votes then immediately count results
NextGoalWins: First response wins (simple, good for sending to single client) - refinement ALL voters are informed
BenignDictator: One person from list is chosen at random - they listen to group and then decide
Unanimous: Repeat vote until all vote for the same (wolves)
DemocracyRules: Once 50% of votes have been cast the remainder have a fixed time to vote
WeNeedAWinner: Once all votes are IN, if there is a draw then repeat vote with just the tied candidates
SecretBallot: Private voting, only the total votes for each player are shown - same logic as WeNeedAWinner
LastManStanding: Start with someone random, they save someone, who saves someone etc last man standing dies
Shortlist: Initial voting leads to a shortlist of 2 or 3 - they each have X seconds to speak, then voting takes place between the others

Ability to select the voting systems to use in the game options - plus a strategy for choosing voting system (random, ordered, etc)

Front-End
Spent a LOT of time looking at the front-end and trying to find a robust way to display and animate elements.
Conclusions from work:
BODY scale works well BUT... I'm really shit at figuring this stuff out. Went round and round for ages trying to get it to work.
Key findings:
1. once the BODY scale is in place then all positioning can be done using the logical (canvas) coords of 1920px width.
2. positioning the Y coord is different because the BODY is scaled based on width. Therefore the y coord uses the scale and then makes an adjustment based on the difference between actual height and logical (canvas) height of 1080px
3. querying DOM elements directly using getBoundingClientRect CAN work, but it DOESN'T respect the scale so these must be converted from screen to canvas coords.
4. better than above would be to maintain a robust model of the layout and only ever use the layout model - more to do here
5. using getBoundingClientRect does not work for player elements since their origin is not top left - never query their position, should always know their Y coords from the layout model
6. getBoundingClientRect is fine for container DIVs which are accurately positioned ALTHOUGH maybe better still to just use layout model
7. there might be some utility in giving container DIVs a width and height, and using that to layout their contents (with flexible arrangement system for aligning/arranging within their bounds) - this is building an entire layout system but it could be useful...
8. above also useful for debugging as each DIV can be given a colour and their screen space easily visualised
9. even if above is used, its probably not good practice to refer directly to their width/height to decide internal arrangement, instead maintain a view-model which is concrete and reliable (non-browser-dependent)

Also, some other useful notes:
Use GSAP timelines to build complex animations programmatically works well.
Example the voting results, worked pretty much first time when I tried it, and avoided lots of chained async calls with nested Promise() levels
Use the onStart and onComplete within timelines also works fine, meaning things can be triggered inside the timeline
Moving towards an architecture where the logic places elements into relevant containers and then a GSAP timeline to layout all elements within a container.
Then the logic becomes simply deciding which containers to place elements and then calling arrangeElement functions to tween all elements within the container.
This will need more time in defining the container structures in advance, then its just about moving elements from container to container - easy!
More needed on above - but the building blocks are already in place.

I created a function that assigns a new parent to an element - this works well, adjusting the coordinates so it doesn't change on the screen.
This function will be very useful with the new architecture - re-assign the parent, then arrange all elements of the parent.
Using the above system will it be possible to always determine the x,y position of an element? If so then it will not be necessary to store the y position as a data-y attribute of an element.
This was a part-solution that works, but better to be able to always calculate the position via the layout model.
So it would mean a way to always generate the (x,y) of an element within its container.
This function can be called to arrange the element, and also when re-parenting the element to maintain the screen position.
I like this approach, everything has a well-defined position (which could in theory be as complex as I like) which is deterministic and should always work.
Quesiton might become do I use the position of the element within the DOM container? Or a separate index of elements (an array of items) and use that?
This might be an example where the reality is that using the DOM is simpler and still very reliable. Otherwise everyhing I do in the DOM I have to do in the 'shadow DOM' - re-assigning parents and splicing arrays and inserting into other arrays... might be easier just to rely on the DOM...
I believe the DOM approach will work OK - as long as the items are always re-arranged every time an item is added or removed. This ensures the positions are kept uptodate.
Since all arrange functions will work with timelines (which can be simultaneous) it should all work pretty well.

One thing to test: when adding two timelines together using tl.add(newtl) - if newtl has items added with "<" at the end to say simultaneous with previous item - will this work accross tl.add calls?
- Yes, I still haven't tested the above! It would make sense if I PROPERLY test this so I know how timelines REALLY work in practice. I fiddled around with adding labels, dummy callbacks etc. What is the BEST approach here?
- RUN A TEST! TIMELINES IN DEPTH!!!

Now comes the moment to try splitting out the game logic and the room logic, ready for adding multiple games.
Rory suggested doing Secret Hitler, which is a great idea since its a great game and I can use it for free legally as long as I dont charge for it.
This would be a great second game even before the quiz since its quite addictive... and would be a good test of a typical game (more graphics and more complex game logic)

Then get on with building a quiz...

Went on a BIG loop trying to add webpack and dynamic loading of modules - very clever
In the end went slightly full circle with it, got into too much complexity with the webpack dynamic loading.
Why? Its all possible, but like a lot of these things it gets complex and dubious benefits - solve one problem cause two more...
I was trying to be so optimised that it would always stay in the host.html page and everything would dynamically load from there.
But to try to load all the components dynamically and have them all link up worked but got very confusing
All just to avoid doing a page reload - maybe I didn't like the 'flash' of white as it loaded a new page, but that's about the only benefit.
So instead try to solve the 'flash' issue and then just load each game as a complete self-contained unit.
Way easier and much simpler to understand.

Compromise - I will still use webpack to bundle files mainly for the minification and obfusaction of source code.
But essentially each game will reload everything it needs, including the vendor libraries. No problem...
Maybe the vendor bundle needs to be stored in the top level while the games are in their own subdirectories?

Maybe this way I can avoid the loading of all audio files until they are needed?... Need to check when the audio file actually gets loaded.
Ask copilot. Says that its possible to delay the loading but of course this might cause a delay when the audio is needed.
Only do this if load times becomes too great which I doubt
Maybe load the important files first and then while the intro is playing the rest can download.

Bundler:
- werewolves
---werewolves.js
---audio.werewolves.js
---dom.werewolves.js
---socket.werewolves.js
These can all get bundled into werewolves.js stored in the public folder alongside vendor bundle
Audio would be fetched from public/audio/werewolves/filename.mp3
css from public/css/werewolves.css
All javascript bundled into werewolves.js

Update: went on even BIGGER loop trying to get webpack sorted out in a way I was happy with. In the end, for reasons I can't quite remember
but related to the fact that webpack tries to be too clever by half, I switched to using Parcel as a bundler.
THEN after another couple of wasted hours fiddling with Parcel and then finding this also had issues with referencing image files in the html (it insisted on finding them and bundling them which I don't want)
I switched AGAIN to using rollup. Why? Because copilot insisted that rollup would only operate on Javascript files and leave everything else alone.
Which is true... and it seems to work ok with MINIMUM of cleverness! Just do something simple and do it well is the motto...

It didn't help that within the above loops my browser started playing up and adding trailing slash to every request which sent me round in circles trying to fix the routes.js
In the end just a browser reset and it worked fine again PFFF!!!

SO... final architecture is similar to above except we also bundle audiomanager.js and gsap into the game bundle.
Since we're not loading anything dynamically anymore we might as well build a single game bundle.
Tried bundling socket.io but this seems to rely on lots of node modules which rollup had lots of difficulty with so just loading that from a CDN in the HTML page

/host directory stores all the html files for the games (eg lobby.html,, werewolves.html, quiz.html) which is SO SIMPLE!
werewolves.html can set out its own HTML and then load the werewolves.min.js entry point which is the minified bundle.
Slight issue with getting the timing of things working on startup - DOM must be created first, then init called to scale the BODY tag, then and only then the socket.io library initialised and socket event handlers defined.

FINALLY seems to be working quite well.

Still need to add proper authentication on /host dircetory but that can come later.

Now finish off werewolves and get on with the next game! And hopefully the next one will be a LOT quicker...

TO DO WEREWOLVES:
Introduction - user journey from selecting game from lobby, what happens next?
Game options - re-usable component allowing game options to be selected (selection of form elements, radio buttons, checkboxes etc)
Game mode - fully auto, semi-auto, manual - allows different hosting styles. Maybe start with manual and auto (semi-auto can come later)
Additional audio recording - introduction, game rules, check your role, explain each day voting round
Music and fx to buff audio
Game rules - aim for re-usability, every game will need some kind of animated rules section, try to make a rules module which can be plugged in easily
Wireframes showing screenshots of werewolves layout at each step - work to a design!
Identify (and fix!) colour schemes, typeface, styles to use across the board (with each game providing its custom version for branding)

*** PHASER ***

Oh Jesus... so I have spent I don't know how many hours on building all the code for werewolves and quiz in HTML, Javascript and GSOP.
And then, randomly, copilot suggested using a library like Phaser for building games, and it looks SO much better.
Why didn't I do more research when I first started this damn project (18 months ago...) ?
Everything in Phaser looks more solid, reliable, responsive, multi-platform, ...
They have built a better version of everything that I was building, neater, cleaner, better-designed.
So it looks like I'm not on a massive new project to RE-WRITE everything (!) in Phaser :(
No doubt there will be issues along the way but it already feels like the time taken to do straightforward things is way less.

Also: memo to self, I should be leaning into AI more - they can pretty much write this stuff without me doing anything. Will be way faster, and I can focus on adding more games
If I took the line that this will not be production-worthy until I have, say, 10 games then suddenly adding more games as quickly as possible becomes far more important than making each game perfect.
So get on with Phaser, AI, building games and see how quickly I can knock out the first 5 games. Then the next 5...


TO DO WEBSITE:
Attach a DB / ORM and persist user data and game results
Login using Passport for membership options - only relevant for hosting, players don't store anything
Added MongoDB Atlas connection - need to build this out and store user data / game results in DB
MongoDB admin user: bensilburn:kPHOzuUNDhr8H5oY


*** SYSTEM ADMINISTRATION ***
NOTES FROM DIGITAL OCEAN admin
Restart nginx: systemctl restart nginx
Test nginx config: nginx -t 

I used to run everything as root, but I've now created a new user nodejs/nodeAdm1n - always use this user from now on.
Select Access in the left menu and run the console using user nodejs
Run all nginx commands with sudo to ensure correct privileges

SSH authorized keys
I added a .ssh/authorized_keys file on the server with a copy of a key generated on my local machine
ssh-keygen -t rsa -b 4096 -C "ben@videoswipe.net"
This generates a local file ~/.ssh/id_rsa.pub 
This line (long line of text) needs to be added to remote .ssh/authorized_keys file

To refresh files from the git repo:
cd supermassive
git reset --hard HEAD (this gets git uptodate and will ignore any changes made on the server)
git pull (grabs everything from the repo)

To start/stop the app using pm2:
cd supermassive
pm2 start server.js
To check the status of pm2 processes:
pm2 list
If output from pm2 looks good (ie only one instance running and it is working correctly):
pm2 save
this will save the current process list and restore it if the server reboots

To directly upload files to server without going via git repo (useful for quick uploading or files that don't need to be stored in git):
scp <local file> <remote dir>, eg:
$ scp modules/moneytree.min.js nodejs@videoswipe.net:~/supermassive/public/modules

EADDRINUSE errors - I kept getting this error on Digital Ocean server. Process already listening on port 3000.
This happens is two processes are running at the same time - need to ensure only a single instance of the app is running, check pm2 list


*** BROWSER ISSUES ***
TIP: MS Edge gets confused with its cache - always run with cache disabled! Dev Tools Network tab top of panel
This will solve a lot of headaches - I spent a good three hours trying to fix server behaviour and it was just EDGE being dumb with caching and re-writing requests

*** TEXT TO SPEECH ***
Spent some time looking into Text-to-Speech solutions. Lots to choose from.
I went with 11labs as it seemed to have a large variety of different voices available.
Also it has a free tier so you can generate around 10 minutes of speech each month.
If I start now I can generate probably around two quizzes each month, maybe more. By next year I'll already have a deent number and can keep adding.
Also take a look at Speechify - this has celebrity voices that I could use eg Snoop Dogg and Mr. Beast. Also has API access. Might be a good option if 11labs doesn't do enough.
Finally, never forget OpenAI Whisper - very professional and not expensive for large amounts of speech ($0.006 per minute I think)

11labs API works pretty easily. I got a version working in an hour or less. Now I will need some code that will take an entire quiz, collect up all the required speech, batch convert it and store all the audio into a directory. Need a good way of IDing a quiz.
Maybe also store each question as a separate file so in theory quizzes can mix and match questions. In other words the quiz would be a series of question IDs and those question IDs have textual questions and an audio file for question and answers.
Makes for maximum flexibility...
Maybe also need a system for the rest of the script. Break down the quiz into components and have several versions of each component.
That way each quiz will sound slightly different.

ALso had an idea of having two separate hosts for variety. One is the main question master while one provides summaries in between rounds to explain what is happening.
The summaries could be good but would need to be synchronised with the answers in some way so that it fits in the with animation.

One benefit of switching to OpenAI is that they also provide a speech-to-text option which means I could experiment with audio recording the answer and sending to OpenAI for analysing
It might be good enough to use in real-life if the answers are short.
Would need to combine with some kind of fuzzy word matching so that it can handle odd pronunciations.
Best would probably be if the answers are not people's names...

TODO QUIZ:
Ok I know I still have things to do with Werewolves, but I am more inspired by the quiz at the moment so running with this one.
More AI research - AI for sound FX and audio tracks? Quiz show music could be AI-generated?
What about code to animate a quiz-master? Simple 2D animation using simple face elements... how is this done?
Thinking about making the quiz-master deliberately an AI robot so its clear to everyone, can also make design look like a hologram.
Simple solution would be to make quiz-master appear in a screen so its obviously a 2D image.
Getting into silly ideas here but possible to make the avatar appear like a shadow so character could go into a spotlight for extra tension?
Need to juice the round summary animations to make more like a race. Remember there was that 'race' effect on a website used by Emile for the company quiz. Where was that?
Write a full script for the quiz that can be used for all quizzes.
Need to break down the quiz script into all the components and have a track (or tracks) for each element.
Will also need a script for the assistant(s)
Idea is that maybe there are four or five characters and you can choose who will host and who will assist. Each character can do either role - the script will vary per character.

Research on Character Animations for Game hosts...
Adobe Character Animator is good but expensive $50 per month.
Reallusion iClone is professional quality but quite expensive one-time $399.
Both can import a character puppet and then trigger in-built animations. They both offer audio sync and motion capture via webcam.
Reallusion also has a large content market for characters and elements such as clothes and hair. This for us in their other product: Character Creator, used for creating human-like characters
Of course in the big picture $399 is not a lot if it saves me three weeks of programming.
BUT I might still investigate how far I can go with using a puppet, since these have a well-defined format and maybe it is easier to create simple animations than I think.

Other option: Reallusion also has a Cartoon Animator 5 product which is a lot simpler and uses 2D animations, only $99
Problem might still be where do I get a good character graphic from? A lot of the ones I've seen are childish I want something a bit cooler...
Maybe another AI image generator can generate the face for me??? Check out midjourney or Firefly
Tried Firefly and it should be able to create quite a cool-looking character. CTA5 seems to have the tools to rig the face and perform animations, largely out of the box.
I think I will need to install the trial version and spend a few hours playing around with it - see if I can get something working...

Need a quiz question importer, capable of reading a CSV file and displaying all the details in a way that can be further edited and then saved.
Rather than storing quizzes in the DB I might more easily store as a CSV file - then each quiz is just a file. Can load the quiz and convert to JSON for use in the quiz.
This makes it much easier to quickly read a quiz and see whats in it, rather than having to read an entire JSON object just to summarise the quiz...
Decide on a file format, give it a version number (so different file format versions can be supported)
Maybe include the version in the filename eq quiz-id123346.v2.CSV
This way I already know the version number when reading the file, makes more straightforward can easily select the parser at the top.
quiz,Title of the Quiz,Description - additional information which can include basic HTML <b>markup</b> but nothing complex like <script...>
round,Title of this round,Description - additional info on round - similar to quiz above,{overrides}
question,questiontype,Remainder of line determined by what type of question it is... eg basic will be a question and then up to 6 answers
question,basic,What is the capital of France?,Paris,Madrid,Berlin,London
question,truefalse,True or False? An apple is a vegetable?,False
question,sort,Arrange the following in alphabetical order,Apple,Banana,Cabbage,Donkey,{overrides}
question,buzzer,Who is the first to know the answer to this question?

Question type can have additional params appended with a '-' eg question-timed meaning this question is about speed of answering
(Note all questions are timed, there is a fixed time limoit, a -timed question means the speed of answering is logged and a strategy for determining score must be provided)
Some other possible overrides:
duration:x  how long to answer the question?
summary:no  does this round end with a summary? Allows eg two rounds to be summarised together...
script:"Alternative version of script to provide custom speech at a point"
Or maybe script-replace, script-append, script-prepend to replace or insert speech into existing script
Maybe a way to include a question (or several) at the beginning of the quiz and give answers at the end...
I guess the way to do this would be to inclue a question at the beginning which has NO answers.
Then at the point at which an answer is required (end of quiz) ask the question again, and this time collect answers.
question could be of type:number or type:integer which means allow players to enter a numeric value (or integer)
or type:text which allows players to enter a word or series of letters/numbers if the answer is some kind of code...


*** MUSIC, AUDIO and FX ***

Digression: good music for quiz background
Best example found so far on pixabay for free music https://pixabay.com/users/3433550/?tab=all&order=latest&pagi=1
There are three Epic War tracks that sound the most dramatic and useful for a quiz
Don't want to spend too long on this as there are more important things to do, just get a decent first version and move on...

Consider testing out Sona AI or ElevenLabs AI for music generation. Listened to some samples and it sounds like they are pretty amazing
Could exeriment with some generation for the music, shorter and longer versions etc
ElevenLabs is not live with the music but the initial demo was pretty good


*** COPILOT and AI HELP ***
Looked into other AI copilot type sites.
Cursor AI seems to be very popular and powerful. A bit more to learn to get the most out of them.
$20 per month so double the cost of MS copilot but might be better.
Separate site cursor.directory which provides templates for guiding the AI in how to work - supposedly very good for setting up AI
You can add the above text from cursor.directory directly into a cursorrules file and it will always use this template for writing code.
Makes it use good coding style, latest practices etc
Good video on the topic: https://www.youtube.com/watch?v=gqUQbjsYZLQ
Tip: tag the documentation so that the AI will refer to this documentation.

Also v0 gave some pretty good results when I tried it.

Currently running both VS Code (with copilot) and Cursor (with their own model, can use Claude which is very good)
Switching between them since sometimes one seems to stop, complaining about free tier - so with both available one is usually up and running


Sending mail via gmail using nodemailer
Created an app for 'less secure devices' not sure if this is important but I created one
It gave this password : ooeq ikse pmpy annb
Paste this into gmail somewhere if needed, but for now just try using regular gmail login


*** GENERAL MOTIVATION and DIRECTION ***

From Cursor AI chat:
Here are some strategies to help you maintain forward momentum in your projects:
- Set clear milestones: Define what "done" looks like for each feature or component.    
- Use the MVP (Minimum Viable Product) approach: Implement the basic functionality first, then iterate.
- Time-box your work: Allocate a specific amount of time for each task and move on when time is up.
- Practice the "good enough" principle: Aim for code that works and is reasonably clean, not perfection.
- Keep a "future improvements" list: Note down ideas for optimization or refactoring, but don't implement them immediately.
- Regular code reviews: These can help catch major issues without getting bogged down in minor details.
- Focus on user value: Prioritize features that directly benefit your users.
- Use TODO comments: Mark areas for future improvement in your code without stopping to address them immediately.
- Embrace iterative development: Remember that you can always come back and improve things in future iterations.
- Maintain a healthy perspective: Sometimes, understanding a problem deeply is more valuable than solving it perfectly the first time.


*** OTHER IDEAS ***

From Cursor AI Chat - ideas for dashboard page:
User Profile/Dashboard:
a) User Info:
Username, avatar, join date
Overall level or rank
b) Achievement Showcase:
Display of earned trophies, badges, or achievements
Progress bars for ongoing achievements
c) Stats Overview:
Total games played, win rate, favorite games
XP earned, current level, XP needed for next level
d) Recent Activity:
Latest games played
Recent achievements or level-ups
e) Leaderboards:
User's ranking in various categories
Comparison with friends or global rankings
f) Rewards Section:
Available rewards or perks based on current level/achievements
Maybe a "reward store" where users can spend earned points
g) Challenges:
Current challenges or quests the user can complete
Rewards for completing these challenges
h) Customization Options:
Ability to customize profile appearance or settings
i) Friends/Social:
List of friends or option to add friends
Maybe a feed of friends' recent activities
j) Notifications:
Alerts for new challenges, friend requests, or site updates

For both pages, consider how you'll structure the information hierarchically and how users will navigate between different sections. Also, think about how these elements will adapt to different screen sizes for responsive design.

Landing Page:
Header:
Logo (left)
Navigation menu (right)
Sign Up / Login buttons (far right)
Hero Section:
Bold, attention-grabbing headline
Subheadline explaining the unique value proposition
CTA button ("Start Playing" or "Join Now")
Background image or animation related to gaming
Featured Games:
Grid or carousel of game thumbnails
Each thumbnail: game image, title, brief description, "Play Now" button
How It Works:
3-4 step process with icons
Brief explanation for each step
User Testimonials:
Carousel or grid of user quotes with their avatars
Gamification Teaser:
Visual representation of levels, trophies, or achievements
Brief explanation of the reward system
News/Updates:
Blog-style list of recent updates or upcoming features
Final CTA:
Repeated sign-up button
Reinforcement of key benefits
9. Footer:
Links to About, Contact, Terms of Service, etc.
Social media links
Copyright information

For the visual design:
1. Color Scheme: Consider using a combination of dark and vibrant colors. For example:
Dark background (deep blue or charcoal)
Bright accent colors for CTAs and important elements (neon blue, electric green)
White or light gray for text to ensure readability
Typography:
Modern, clean sans-serif font for body text
Perhaps a more stylized font for headings to add personality
Imagery:
High-quality game graphics or screenshots
Custom illustrations for the "How It Works" section
Subtle animated elements to add dynamism without being distracting

Layout:
Responsive grid system to ensure the design works on all devices
Ample white space to prevent the page from feeling cluttered


From Cursor AI Chat (future directions for quiz builder):

1. Error Handling: We could add more robust error handling, especially for JSON import/export and image uploads.
2. Validation: Implement input validation to ensure all required fields are filled and data is in the correct format before export.
3. Accessibility: Enhance the UI with proper ARIA attributes and keyboard navigation to make it more accessible.
4. Styling: Improve the visual design for a better user experience.
5. Performance Optimization: For larger quizzes, we might want to implement lazy loading or pagination.
6. Undo/Redo Functionality: This could be a valuable feature for users building complex quizzes.
7. Local Storage: Implement auto-save functionality using browser local storage to prevent data loss.
8. Question Templates: Allow users to save and reuse question templates.
9. Quiz Preview: Add a feature to preview the quiz as it would appear to participants.
10. Multiple Choice Question Enhancement: Allow for variable numbers of options in multiple-choice questions.


Image Selector Custom HTML element
Jotting down some notes on this custom element as it is a right pain in the ass to get working properly.
Here are some important notes about using custom elements - tests done in Microsoft Edge:
the image-selector tag must have a height specified, and it must NOT use %. So width:100% is ok but height:100% is NOT.
If height:100% is used then the image simply does not show and has a height of 0.
I have tried messing around with the :host CSS in image-selector and container divs to set height but nothing seems to work.
TL;DR set the height on the image-selector directly using px or vh to make the image display.



COPILOT - REPORT ON SUPERMASSIVE

# Building a Community-Focused Quiz Platform

You're on the right track with focusing on community and personalization features. Let's brainstorm some features that would help create a vibrant ecosystem where quiz enthusiasts can create, share, and discover content.

## Dashboard & Discovery Features

### 1. Enhanced Quiz Library
- **Featured Quizzes**: Showcase popular or staff-picked quizzes on the dashboard
- **Category Browsing**: Allow filtering by topics (Movies, Music, Sports, etc.)
- **Difficulty Levels**: Easy, Medium, Hard, Expert tags for quizzes
- **Quiz Collections**: Themed sets like "Movie Night," "90s Nostalgia," or "Family Game Night"

### 2. Robust Tagging System
- **Content Tags**: Family-friendly, Adult humor, Educational, Pop culture
- **Format Tags**: Rapid-fire, Picture rounds, Audio questions, Video clips
- **Duration Tags**: Quick (5-10 min), Medium (15-30 min), Full event (45+ min)
- **Audience Tags**: Kids, Teens, Adults, Mixed ages, Subject experts

### 3. Advanced Search & Filters
- **Combination Filtering**: "Show me family-friendly movie quizzes under 30 minutes"
- **Similar Quizzes**: "If you liked this, you might also enjoy..."
- **Occasion Matching**: "Perfect for birthday parties" or "Great for team building"

## Community & Social Features

### 1. User Profiles & Achievements
- **Creator Profiles**: Showcase published quizzes, ratings, and specialties
- **Badges**: "Top Creator," "Trivia Master," "Community Favorite"
- **Activity Feed**: Show recent activities of followed creators
- **Statistics**: Number of plays, average scores, most challenging questions

### 2. Rating & Feedback System
- **Star Ratings**: Overall quality rating
- **Multi-dimensional Ratings**: Fun factor, difficulty, creativity
- **Review System**: Allow detailed feedback with moderation
- **Question-level Feedback**: Flag problematic questions or suggest improvements

### 3. Sharing & Collaboration
- **Public/Private Settings**: Control who can access your quizzes
- **Co-creation**: Allow multiple users to collaborate on quiz building
- **Social Media Integration**: Easy sharing to Facebook events, Discord, etc.
- **Embed Codes**: Let users embed quiz links on their own websites/blogs

## Personalization Features

### 1. Quiz Customization
- **Branding Options**: Custom themes, colors, logos for quizzes
- **Host Messages**: Personalized introductions and conclusions
- **Custom Scoring**: Weight questions differently based on difficulty
- **Adaptive Difficulty**: Optional dynamic adjustment based on player performance

### 2. Special Occasion Templates
- **Birthday Quiz Template**: Pre-populated with spaces for personalized questions
- **Wedding/Anniversary**: Template for creating "How well do you know the couple?" quizzes
- **Farewell Events**: "How well do you know your departing colleague?" template

### 3. Smart Recommendations
- **Based on History**: "Based on quizzes you've hosted before..."
- **Seasonal Suggestions**: Holiday-themed quizzes when relevant
- **Group-based Recommendations**: "Perfect for your regular Thursday game night"


## MVP Feature Set

If you want to start small but impactful, I'd recommend this initial set:

1. **Basic Tagging System**: Allow creators to add 3-5 tags to their quizzes
2. **Simple Quiz Rating**: Just overall stars with optional comments
3. **Public/Private Toggle**: Control who can see your quizzes
4. **Featured Quizzes Section**: Admin-selected quizzes to highlight
5. **Creator Profiles**: Simple pages showing a user's created content

This gives you the foundation for community features without overwhelming development.

## Next Phase Features

Once the basics are in place, consider adding:

1. **Collections/Playlists**: Let users group quizzes together
2. **Following System**: Allow users to follow creators they enjoy
3. **Advanced Search**: With multiple filters and tags
4. **Embeddable Quizzes**: Share across platforms
5. **Analytics Dashboard**: For quiz creators to see how their content performs

## Development Approach

1. **Start with the data model**: Update your database schema to support these features
2. **Build the API layer**: Create endpoints for the community functionality
3. **Implement the UI components**: Build the frontend elements in phases
4. **Test with a small user group**: Get feedback from real quiz enthusiasts

This community-focused approach would help differentiate your platform from Kahoot (which is education-focused) and Jackbox (which lacks user-generated content). By creating a place where quiz enthusiasts can not only play but also create, share, and discover content, you'd be filling a genuine gap in the market.


Competitors:

Hashtag Quiz
Aiming at Pub Quiz market - probably closest I've seen to Supermassive
They claim:
Hospitality - ie pubs
Care Sector - research shows that quizzes boost recall so could be useful in care homes
Education/Training = "classroom or remote working fun"
Fundraising - charity events
Live Streamers - "turn your viewers into participants" targeting influencers could be good niche
Not much content, possibly quite new, forces even players to register
Free tier allows one host two players
Database of questions and quizzes, with several different owners credited
Seems to also provide feature for assigning other quiz masters

Quizizz
Very thorough educational site allows lectures to be screened and interspersed with questions
Didn't work very well when I tried...
LOTS of content on all sorts of subjects
Very nice resource for teachers, provides stats and reports on who answered what, who might need help etc
'Classroom Pulse' feature - open in separate tab - monitors students
Players have ability to raise hand ask for help, ask for more time
Also ALL of my question types plus a few more! eg enter first letter of answer (easier than typing), fill in the blank (drop-down of options)

Testportal.net
Looks quite professional, aimed at companies for company training, sectors like restaurants, stats for how well each student performs
Questions broken down into things like 'Data analysis', 'Inductive reasoning'
Seems more like offline training so employee completes training on their own time in browser
Interesting market - company training


# === GIT CHEAT CHEET ===
# === STARTING A BIG REFACTOR ===
git checkout -b refactor/NAME  # Create branch (once)
git commit -am "message"       # Normal commits (many times)
git push origin refactor/NAME  # Push branch to remote (safe backup!)

# === CHECKING STATUS ===
git branch                     # Which branch am I on?
git status                     # What files changed?

# === FINISHING REFACTOR (when ALL working) ===
git checkout main              # Go back to main
git merge refactor/NAME        # Merge branch into main
git push                       # Push to remote
git branch -d refactor/NAME    # Delete branch (optional)

# === OOPS, I MESSED UP ===
git log --oneline              # See recent commits
git reset --hard HEAD~1        # Undo last commit (DANGER!)
# → Ask AI for help! Paste git log output.


I just keep adding random shit to the end of this document in the hope that one day, some day I'll go back and read some of this...
For now maybe it just acts as a useful brain dump to get stuff out of my head.

Looking to stream some live quizzes on Twitch, this is the latest BIG idea to make something out of all this
So I need to focus and build a TODO focused on getting the Twitch quizzes launched:

Twitch - set up channel add images, text
YouTube - similar - ready for uploading after the live stream has ended
GhostManager - better ability to guess answers  give realistic guesses for text/numeric (maybe hook into real answers if any are available ?)
Admin - ensure entire quiz can be controlled from admin (2nd host) including eg Instructions Panel toggling
Server - protection on the host route (anyone can visit host/ROOM/quiz and join as host)
Website
- finish off the work on Seasons, Episodes
- visibility of quizzes and display of leaderboards
- private leaderboards
- how-to guides

Streaming:
- make pre-recorded movies for the transitions eg demoing the host screen
- build the stingers/transitions for the live stream (intro, transition into quiz, quiz round changes, outro)
- run a couple of tests

QUIZ GAME TODO LIST PRE LAUNCH
DONE 1. Lobby state: music needed to last a full 10 minutes, current music track stops after 15 seconds
DONE 2. Console error The AudioContext was not allowed to start. Might not need code change but it seems I need to focus the host window in order for audio to play - something in the stream setup phase possibly
3. End of countdown timer will mark the beginning of the stream. This is when I imagine I will start streaming from the webcam and introduce myself and the quiz. This could use a stinger-type transition to announce 'we are starting!'
4. Something wrong with the state change on the server if I go backwards I can never set the round number back to round 1, if I cycle all the way back and then step forward it still starts at round 2
5. I will then do a short introduction which should still have a 'live' feel in the main quiz screen, players still floating. This introduction might also include a mention of VideoSwipe and things like leaderboards where players can see the results - this could use a pre-recorded video that OBS can play out to illustrate the introduction
DONE 6. The NEXT_ROUND state has a screen to display the round title and description. It is not great but it works well enough for now
7. Remove the various 'START ROUND' buttons on the screen - we have moved to an entirely keyboard based controller so there isno need for these anymore
8. Logic controlling the 'flame' effect on player avatars added during the show-answers state needs some tightening - player has fewer points but still has the flame effect
9. General note on Ordering UI: if more than six players it will never be able to show them all - might not be an issue for first quiz but if all goes well it will need re-factoring to allow more than 6 teams
DONE 10. Ordering - BIG problem with another annoying quirk I introduced. Ordering question also has a keyboard handler to allow the host to step through the answers one player at a time. This does not route through the server so only works on admin screen. Need to re-think this...
11. Ordering question when items have no images has no reveal answer timeline at the moment... pff
DONE 12. Number-closest if a player is snoozed then it should have a snooze animation similar to Ordering
DONE 13. End of quiz we already have a nice podium effect with music and graphics and this seems ok
14. We even have a closing credits after the podium which displays a scrolling text block listing all the players and thanking everyone for playing. I imagine that this is when the webcam disappears and players can read the credits if they wish. Once the credits have rolled OBS could then transition to a final 'advert' for the next quiz, direct people to the website to sign up and save their scores.
15. Player phones have a 'rate this quiz' screen at the end which I really like. If they do rate the quiz it could also offer a 'share your result' post which allows them to promote the quiz to facebook, twitter etc. I don't know how to do that - could be worth adding?
16. Quiz title seems a bit off - sometimes it displays a different name to the actual quiz name, should only ever use the quiz name no default that will just confuse


