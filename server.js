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


////////////////// GLOBAL VARIBLES /////////////////////
let allData = [];      // array to store all student pickup data(sent to react)
let latestData = null;  // store the most recent entry 
let currentStation = 0; // current station being assigned for pickup
let TOTAL_STATIONS = 1;


async function init() {
  // Get the number of stations from the supabase database. 
  try{
    const {count, stationError} = await supabase 
      .from("stations")
      .select("id", { count: "exact", head: true });
    if(stationError){
      throw error;
    }

    TOTAL_STATIONS = count || 1;

    // Run the server on port 25565
    app.listen(25565, '0.0.0.0', () => {
      console.log('Server running on port 25565');
      console.log('Total stations:', TOTAL_STATIONS);
    });
  }
  catch(err){
    console.error("Supabase Failure: ", err);
    process.exit(1);
  }
}
init();

// FUNCTION TO ASSIGN STATIONS
function assignStation(name, parent){
  const station=1+ (currentStation % TOTAL_STATIONS);
  currentStation++; // add one for next time
  console.log('Total stations:', TOTAL_STATIONS);
  return { name, parent, station};
}

// POST /data receives new student pickup data
app.post('/data', (req, res) => {
  const { name, parent } = req.body;

  if (!name || !parent) {
    return res.status(400).json({ error: 'Missing name or parent' });
  }

  const newEntry = assignStation( name, parent );
  latestData = newEntry;
  allData.push(newEntry);

  console.log('Received:', newEntry);

  res.json({
    success: true,
    data: newEntry,
  });
});


/// Sends All Data Currently being stored to the React Server
app.get('/data', (req, res) => {
  res.json(allData);
});

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

     



