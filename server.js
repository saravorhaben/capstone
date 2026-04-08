require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

let allData = [];      // array to store all student pickup data
let latestData = null; // store the most recent entry 

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_DEFAULT_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

// Station rotation
const TOTAL_STATIONS = 6; ///// UPDATE BASED ON NUMBER OF STATIONS~!!!!
let currentStation = 0;

app.post('/plate', async (req, res) => {
  const { license_plate, plate_state } = req.body;

  if (!license_plate || !plate_state) {
    return res.status(400).json({
      error: 'Missing license_plate or plate_state'
    });
  }

  try {
    const { data, error } = await supabase
      .from('students')
      .select('name, parent')
      .eq('license_plate', license_plate.toUpperCase())
      .eq('plate_state', plate_state.toUpperCase());

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({
        error: 'No student found for this license plate and state'
      });
    }

    currentStation = (currentStation % TOTAL_STATIONS) + 1;

    const responseData = {
      station: currentStation,
      license_plate: license_plate.toUpperCase(),
      plate_state: plate_state.toUpperCase(),
      students: data
    };

    console.log('Matched vehicle:', responseData);

    res.json(responseData);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

// POST /data receives new student pickup data
app.post('/data', (req, res) => {
  const { name, parent } = req.body;

  if (!name || !parent) {
    return res.status(400).json({ error: 'Missing name or parent' });
  }

  const newEntry = { name, parent };
  latestData = newEntry;
  allData.push(newEntry);

  console.log('Received:', newEntry);

  res.json({
    success: true,
    data: newEntry,
  });
});

app.get('/data', (req, res) => {
  res.json(allData);
});

                              

app.listen(25565, '0.0.0.0', () => {
  console.log('Server running on port 25565');
});

