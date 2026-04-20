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
let stationColors = [];
let scan_success = false;

async function getStations() {
  try {
    const { count, error: stationError } = await supabase
      .from("stations")
      .select("id", { count: "exact", head: true });

    const { data: colors, error: stationColorError } = await supabase
      .from("stations")
      .select("color");

    if (stationError) {
      throw stationError;
    }

    if (stationColorError) {
      throw stationColorError;
    }

    stationColors = colors || [];
    return count || 1;
  } catch (err) {
    console.error("Supabase Failure: ", err);
    return 1;
  }
}

async function updateStationCount() {
  const stat = await getStations();
  TOTAL_STATIONS = stat;
  return stat;
}

// things to run on startup....
async function init() {
  TOTAL_STATIONS = await getStations();

  app.listen(25565, '0.0.0.0', async () => {
    console.log('Server running on port 25565');
    console.log('Total stations:', TOTAL_STATIONS);

    // test query
    const testPlate = '9329TX';
    const students = await getStudentsByPlate(testPlate);
    // console.log(`Test Query for ${testPlate}:`, JSON.stringify(students, null, 2));
  });

  // update station count every 5 seconds
  setInterval(updateStationCount, 5000);
}
init();

// query database using license plate
async function getStudentsByPlate(qrCode) {
  // assumes plate number + state, with last 2 characters being state
  const plateNumber = qrCode.slice(0, -2);
  const plateState = qrCode.slice(-2);

  // get parent id
  const { data: parentData, error: parentError } = await supabase
    .from('parent')
    .select('id')
    .eq('plate_number', plateNumber)
    .eq('plate_state', plateState)
    .single();

  if (parentError || !parentData) {
    console.error('Error finding parent:', parentError);
    return null;
  }

  const parentId = parentData.id;

  // find students associated with parent id
  const { data, error } = await supabase
    .from('parent_student')
    .select(`
      pickup_status,
      students (
        student_first_name,
        student_last_name
      )
    `)
    .eq('parent_id', parentId)
    .eq('pickup_status', true);

  if (error) {
    console.error('Error fetching students:', error);
    return null;
  }

  return data;
}

// FUNCTION TO ASSIGN STATIONS
function assignStation(name) {
  const station = 1 + (currentStation % TOTAL_STATIONS);
  currentStation++;
  console.log('Total stations:', TOTAL_STATIONS);
  return { name, station };
}

// POST /data receives new student pickup data
app.post('/data', async (req, res) => {
  const { plate } = req.body;
  console.log(req.body);

  if (!plate) {
    return res.status(400).json({ error: 'plate' });
  }

  // query database for actual student names based on the license plate
  const dbStudents = await getStudentsByPlate(plate);
  let displayName = "";
  let studentList = [];

  if (dbStudents && dbStudents.length > 0) {
    studentList = dbStudents.map(
      s => `${s.students.student_first_name} ${s.students.student_last_name}`
    );
    displayName = studentList.join(', ');
    console.log(`Matched ${dbStudents.length} students from database: ${displayName}`);
  } else {
    console.log('No matching students found → sending null to display');
    latestData = null;
    scan_success = false;

    return res.json({
      success: false,
      data: null
    });
  }

  // Assign a station for this pickup
  
  
  const newEntry = assignStation(displayName);
  
  
  if(displayName != ''){
  latestData = newEntry;
  allData.push(newEntry);

  console.log('Final Pickup Entry:', newEntry);
  scan_success=true; // update for a successful scan
 
  
  
  // note successful qr scan
  res.json({
    success: true,
    data: plate
  });
 }
  

});

// GET all students currently waiting
app.get('/data', (req, res) => {
  res.json(allData);
});

// DELETE one picked-up student
app.delete('/data', (req, res) => {
  const { name, station } = req.body;

  if (!name || !station) {
    return res.status(400).json({ error: 'Missing name or station' });
  }

  const index = allData.findIndex(
    (student) =>
      student.name === name &&
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

// display screen 
app.get('/display', (req, res) => {
  const DEFAULT_MSG = "Please Pull Forward To";
  const SCAN_MSG = "Please Scan QR Code";

  if (latestData === null) {
    latestData = "handled";
    return res.json(null); // triggers black screen once
  }

  if (scan_success) {
    const displayStation = ((currentStation - 1) % TOTAL_STATIONS) + 1;
    res.json(DEFAULT_MSG + displayStation + "Station");
    scan_success = false;
  } else {
    res.json(SCAN_MSG);
  }
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
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
          <img src="/mascot.png" alt/> 
          <h1>Student Pickup Server</h1>
          <p>Status: Connected</p> 
        </div>
      </body>
    </html>
  `);
});

/// MQTT Connection to Zigbee ///////
// const mqtt = require("mqtt");
// const brokerUrl = "mqtt://10.246.167.11";
// const client = mqtt.connect(brokerUrl);

// client.on("connect", () => {
//   console.log("Connected to MQTT broker");
//   client.subscribe("retain", (err) => {
//     if (!err) {
//       console.log("Subscribed to topic");
//     }
//   });

//   client.publish("test/topic", "Hello from Node.js");
// });

// client.on("message", (topic, message) => {
//   console.log(`Message received on ${topic}: ${message.toString()}`);
// });









