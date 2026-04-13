require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());



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
    app.listen(25565, '0.0.0.0', async () => {
      console.log('Server running on port 25565');
      console.log('Total stations:', TOTAL_STATIONS);

      // test query
      const testPlate = '9329TX';
      const students = await getStudentsByPlate(testPlate);
      console.log(`Test Query for ${testPlate}:`, JSON.stringify(students, null, 2));
    });
  }
  catch(err){
    console.error("Supabase Failure: ", err);
    process.exit(1);
  }
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
function assignStation(name, parent){
  const station=1+ (currentStation % TOTAL_STATIONS);
  currentStation++; // add one for next time
  console.log('Total stations:', TOTAL_STATIONS);
  return { name, parent, station};
}

// POST /data receives new student pickup data
app.post('/data', async (req, res) => {
  const { name, parent } = req.body;

  if (!name || !parent) {
    return res.status(400).json({ error: 'Missing name or parent' });
  }

  // query database for actual student names based on the license plate
  const dbStudents = await getStudentsByPlate(parent);
  
  let displayName = name; // fallback to the name from request
  let studentList = [];

  if (dbStudents && dbStudents.length > 0) {
    // Format names: "First Last, First Last"
    studentList = dbStudents.map(s => `${s.students.student_first_name} ${s.students.student_last_name}`);
    displayName = studentList.join(', ');
    console.log(`Matched ${dbStudents.length} students from database: ${displayName}`);
  } else {
    console.log('No matching students found in database, using provided name.');
  }

  // Assign a station for this pickup
  const newEntry = assignStation(displayName, parent);
  
  
  latestData = newEntry;
  allData.push(newEntry);

  console.log('Final Pickup Entry:', newEntry);

  res.json({
    success: true,
    data: newEntry
  });
});


// GET all students currently waiting
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
        </style>
      </head>
      <body>
        <h1>Student Pickup Server</h1>
      </body>
    </html>
  `);
});

     




// app.post('/plate', async (req, res) => {
//   const { license_plate, plate_state } = req.body;

//   if (!license_plate || !plate_state) {
//     return res.status(400).json({
//       error: 'Missing license_plate or plate_state'
//     });
//   }

//   try {
//     const { data, error } = await supabase
//       .from('students')
//       .select('name, parent')
//       .eq('license_plate', license_plate.toUpperCase())
//       .eq('plate_state', plate_state.toUpperCase());

//     if (error) throw error;

//     if (!data || data.length === 0) {
//       return res.status(404).json({
//         error: 'No student found for this license plate and state'
//       });
//     }

//     currentStation = (currentStation % TOTAL_STATIONS) + 1;

//     const responseData = {
//       station: currentStation,
//       license_plate: license_plate.toUpperCase(),
//       plate_state: plate_state.toUpperCase(),
//       students: data
//     };

//     console.log('Matched vehicle:', responseData);

//     res.json(responseData);

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       error: 'Server error'
//     });
//   }
// });

