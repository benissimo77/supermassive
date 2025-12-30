
require('dotenv').config(); // Load environment variables from .env file
const { ElevenLabsClient, play } = require("elevenlabs");
const fs = require('fs').promises; // Import the fs module with promises

const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
const elevenlabs = new ElevenLabsClient({
  apiKey: elevenLabsKey // Defaults to process.env.ELEVENLABS_API_KEY
})

// Function to list all voices available to me (including the three I've added to my account)
async function getVoices() {
    try {
      const voices = await elevenlabs.voices.getAll();
      console.log(voices);
    } catch (error) {
      console.error('Error fetching voices:', error);
    }
  }
  //getVoices();

// The three that I have chosen to start with are:
// Gabriella - deep
// Oswald - intelligent professor
// Queen Rosamund - British, Older Woman
// To start with I'l try Gabriella as the host and Oswald as the assistant who provides the updates between rounds


// Function to list all models available
async function getModels() {
    try {
        const models = await elevenlabs.models.getAll();
        console.log(models);
    } catch (error) {
        console.error('Error fetching voices:', error);
    }
}
//getModels();

// It seems the most useful is eleven_turbo_v2

// Function to actually generate some audio from a text, voice and model
async function generateTTS(voice, text, output_file) {
    try {
        const audio = await elevenlabs.generate({
            voice: voice,
            text: text,
            model_id: "eleven_turbo_v2"
        });
        // Write the audio to a file
        await fs.writeFile(output_file, audio);
        console.log('Audio saved to:', output_file);

    } catch (error) {
        console.error('Error generating TTS:', error);
    }
}
const voice = 'YAhS3Cx3LOUT0e8KBcnE'; // Gabriella - deep
const text = 'Who was the first President of the United States?';
const output_file = 'quiz-question-Gabriella.mp3';
generateTTS(voice, text, output_file);

//console.log('API Key:', elevenLabsKey);
// There is another API available which generates the audio and returns a list of timestamps to align with the audio
// Not tried this yet...
// await client.textToSpeech.convertWithTimestamps("21m00Tcm4TlvDq8ikWAM", {
//     text: "text"
// });

  // const audio = await elevenlabs.generate({
//   voice: "Rachel",
//   text: "Hello! 你好! Hola! नमस्ते! Bonjour! こんにちは! مرحبا! 안녕하세요! Ciao! Cześć! Привіт! வணக்கம்!",
//   model_id: "eleven_multilingual_v2"
// });

// await play(audio);

