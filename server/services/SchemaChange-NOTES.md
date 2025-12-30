CO PILOT SAYS:

Task Checklist for Any New Field
To summarize, here's a checklist in priority order that you can use whenever you add any new field:

Schema Definition

 Add field to JSON schema with type, description, and validation rules
 Define any nested properties if it's an object

Service Layer Updates

 Add default values in createNewQuiz function
 Create normalization logic to handle missing fields
 Update validation logic if necessary

Builder UI Updates

 Create UI elements for editing the new field
 Add field to the settings panel
 Implement any special UI controls (color pickers, dropdowns, etc.)

Data Handling

 Update loadQuizData to populate UI with field values
 Update gatherQuizData to collect values from UI
 Add normalization to createQuizFromJSON for imports

Application Implementation

 Update host application to use the new field
 Update player application to use the new field
 Add default fallbacks in both applications

Migration

 Create a migration script for existing quizzes
 Test migration on development data
 Plan production migration strategy
