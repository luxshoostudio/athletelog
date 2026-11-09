// Normalized picker labels derived from:
// Lux's Bank/2 Areas/Fitness/workouts-by-muscle.md
// The source is a saved-workout catalogue, so its captions are reduced to
// reusable exercise names and grouped by the same muscle/skill sections.
const SOURCE = {
  deadlift:'https://www.instagram.com/reel/DCw8p3vSTeW/',
  squat:'https://www.instagram.com/reel/DCQJjThSGnt/',
  singleLegRdl:'https://www.instagram.com/reel/DEFEwhSPOek/',
  pushup:'https://www.instagram.com/reel/DAjhYIGtkQG/',
  pullup:'https://www.instagram.com/reel/DEwAGI4okvJ/',
  chinup:'https://www.instagram.com/reel/DHF4UngTazd/',
  biceps:'https://www.instagram.com/reel/C_qUsQ-MBei/',
  shoulder:'https://www.instagram.com/reel/DXQXTArieVQ/',
  toesToBar:'https://www.instagram.com/p/DPg97gUCKXt/',
  handstand:'https://www.instagram.com/reel/DDjVJRxR_dA/',
  muscleUp:'https://www.instagram.com/reel/DRm5NTDjLq9/',
  lSit:'https://www.instagram.com/reel/DHdOMACogPn/',
  frontLever:'https://www.instagram.com/reel/DQwcG9XAqCS/',
  planche:'https://www.instagram.com/reel/DJMeOFYMnNW/',
  mobility:'https://www.instagram.com/reel/DIKqy6QtknP/',
  running:'https://www.instagram.com/reel/DH3e_7cRQcv/',
};

const groups = [
  { category:'Lower body', source:SOURCE.squat, items:[['Back Squat',SOURCE.squat],['Front Squat',SOURCE.squat],['Goblet Squat',SOURCE.squat],['Deadlift',SOURCE.deadlift],['Romanian Deadlift (RDL)',SOURCE.deadlift],['Single-leg RDL',SOURCE.singleLegRdl],['Bulgarian Split Squat',SOURCE.squat],'Single Leg Press','Hip Thrust','Glute Bridge','Reverse Lunge','Step-up','Kettlebell Swing','Calf Raise'] },
  { category:'Upper · Push', source:SOURCE.pushup, items:[['Push-ups',SOURCE.pushup],['Pike Push-ups','https://www.instagram.com/reel/DMP5HCosI_1/'],['Handstand Push-ups','https://www.instagram.com/reel/DJwQmTFtJqc/'],'Dips','Bench Press','Overhead Press','Half Kneeling Single Arm DB OHP','Lateral Raises','Reverse Fly','Thruster'] },
  { category:'Upper · Pull', source:SOURCE.pullup, items:[['Pull-ups',SOURCE.pullup],['Chin-ups',SOURCE.chinup],['Wide Grip Pull-ups',SOURCE.chinup],['Scapular Pull-ups','https://www.instagram.com/reel/DLnV8elREQx/'],'Bent Over Row','Ring Row','Inverted Row','Lat Pulldown','Dead Hang','High Pull-up'] },
  { category:'Arms & shoulders', source:SOURCE.shoulder, items:[['Biceps Curl',SOURCE.biceps],'Hammer Curl','Triceps Extension','Forearm Curl','Wrist Curl',['Shoulder Press',SOURCE.shoulder],'Shoulder Flexion Liftoff','Wall Slides'] },
  { category:'Core', source:SOURCE.toesToBar, items:[['Hollow Hold','https://www.instagram.com/reel/DH1NujCoKvm/'],'Plank',['Superman Hold','https://www.instagram.com/reel/DH1NujCoKvm/'],['Toes to Bar',SOURCE.toesToBar],['Hanging Knee Raises',SOURCE.toesToBar],'Dead Bug','Ab Wheel','Side Plank','Dragon Flag','Stability Ball Core'] },
  { category:'Full body & power', source:'https://www.instagram.com/p/DTfxUxykceZ/', items:['Burpee','Clean','Power Clean','Snatch','Landmine Press','Turkish Get-up','Bear Crawl','Box Jump',['Weighted Jump','https://www.instagram.com/p/DTfxUxykceZ/'],['Agility Drill','https://www.instagram.com/p/DZaeu6mmlZ6/']] },
  { category:'Calisthenics skills', source:SOURCE.handstand, items:[['Handstand',SOURCE.handstand],['Handstand Wall Walk','https://www.instagram.com/reel/DKpTBY4uMTC/'],['Handstand Shoulder Taps',SOURCE.handstand],['Muscle-up',SOURCE.muscleUp],['Ring Muscle-up',SOURCE.muscleUp],['False Grip Hold',SOURCE.muscleUp],['L-Sit Hold',SOURCE.lSit],['Front Lever',SOURCE.frontLever],['Front Lever Progression',SOURCE.frontLever],['Planche',SOURCE.planche],['Human Flag','https://www.instagram.com/reel/DKvHWXtJrRu/'],'Pistol Squat'] },
  { category:'Mobility & recovery', source:SOURCE.mobility, items:['Stretching','Hip Mobility',['Shoulder Mobility','https://www.instagram.com/reel/DIB4ZQoKvkB/'],'Ankle Prep','Knee Mobility',['Skin the Cat','https://www.instagram.com/p/DSaPROyjfmp/'],'Bridge Hold','Balancing','Yoga Flow'] },
  { category:'Running & walking', source:SOURCE.running, items:['Running','Walking','Hiking',['Sprint Warm-up',SOURCE.running],['Running Form Drill','https://www.instagram.com/reel/DFSu-xTOQjG/'],'Cadence Drill'] },
];

window.LUX_WORKOUT_BANK = groups.map(group => ({
  category: group.category,
  items: group.items.map(item => Array.isArray(item)
    ? { name:item[0], source:item[1] }
    : { name:item, source:group.source })
}));
