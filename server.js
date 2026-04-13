require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
const path = require("path");
app.use(express.static(path.join(__dirname, "public"))); // allow images to appear


/////////// Supabase Database Access ////////////////////
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_DEFAULT_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

////////////////// GLOBAL VARIABLES /////////////////////
let allData = [];       // array to store all student pickup data
let latestData = null;  // store the most recent entry 
let currentStation = 0; // current station being assigned for pickup
let TOTAL_STATIONS = 1;


// things to run on startup....
async function init() {
  try {
    const { count, error: stationError } = await supabase
      .from("stations")
      .select("id", { count: "exact", head: true });

    if (stationError) {
      throw stationError;
    }

    TOTAL_STATIONS = count || 1;

    app.listen(25565, '0.0.0.0', () => {
      console.log('Server running on port 25565');
      console.log('Total stations:', TOTAL_STATIONS);
    });
  } catch (err) {
    console.error("Supabase Failure: ", err);
    process.exit(1);
  }
}
init();

// FUNCTION TO ASSIGN STATIONS
function assignStation(name, parent) {
  const station = 1 + (currentStation % TOTAL_STATIONS);
  currentStation++;
  console.log('Total stations:', TOTAL_STATIONS);
  return { name, parent, station };
}

// POST /data receives new student pickup data (can probably delete later)
app.post('/data', (req, res) => {
  const { name, parent } = req.body;

  if (!name || !parent) {
    return res.status(400).json({ error: 'Missing name or parent' });
  }

  const newEntry = assignStation(name, parent);
  latestData = newEntry;
  allData.push(newEntry);

  console.log('Received:', newEntry);

  res.json({
    success: true,
    data: newEntry,
  });
});

// GET all students currently waiting (send to website)
app.get('/data', (req, res) => {
  res.json(allData);
});

// DELETE one picked-up student
app.delete('/data', (req, res) => {
  const { name, parent, station } = req.body;

  if (!name || !parent || !station) {
    return res.status(400).json({ error: 'Missing name, parent, or station' });
  }

  const index = allData.findIndex(
    (student) =>
      student.name === name &&
      student.parent === parent &&
      student.station === station
  );

  if (index === -1) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const removedStudent = allData.splice(index, 1)[0];

  console.log('Picked up:', removedStudent);

  res.json({
    success: true,
    removed: removedStudent,
    remaining: allData,
  });
});

// Pretty frontend so doesn't show cannot get on render
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Student Pickup Server</title>
        <style>
          body {
            margin: 0;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, #3A1122, #5A1935, #3A1122);
          }
          h1 {
            color: white;
            font-size: 3rem;
            animation: float 3s ease-in-out infinite;
          }
          p {
            color: white;
          }
        </style>
      </head>
      <body>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; ">
          <img src="/mascot.png" alt/> 
          <h1>Student Pickup Server</h1>
          <p>Status: Connected</p> 
        </div>
      </body>
    </html>
  `);
});


/// MQTT Connection to Zigbee ///////
  const mqtt = require("mqtt");
  const brokerUrl = "mqtt://10.246.167.11";
  const client = mqtt.connect(brokerUrl);

  client.on("connect", () => {
    console.log("Connected to MQTT broker");
  // Subscribe to a topic
  client.subscribe("retain", (err) => {
    if (!err) {
      console.log("Subscribed to topic");
    }
  });

  // Publish a message
  client.publish("test/topic", "Hello from Node.js");
});

// Receive messages
client.on("message", (topic, message) => {
  console.log(`Message received on ${topic}: ${message.toString()}`);
});   



