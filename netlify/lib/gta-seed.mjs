// Verified read-only snapshot of source spreadsheet on 16 November 2026.
// Live sheet exports supersede this snapshot. Never treat this as live data.
const s=(campaign,sourceRow,publisher,cost,posted,postUrl='')=>({
  code:`${campaign}-R${sourceRow}`,campaign,sourceRow,
  sourceTab:campaign==='GTA1'?'X Accounts 12 (GTA)':'X Accounts 14 (GTA VI V2)',
  publisher,profileUrl:`https://x.com/${publisher}`,postUrl,cost,paid:true,posted,
  trackingUrl:'',clicks:null,views:null,likes:null,reposts:null,replies:null,metricAt:null,
});
export const seed=[
  s('GTA1',8,'TheGTABase',200,true,'https://x.com/thegtabase/status/2115927144836776030'),
  s('GTA1',9,'GTAVICentre',250,true,'https://x.com/GTAVICentre/status/2116183392395923786'),
  s('GTA1',10,'GTA_OOC',140,true,'https://x.com/GTA_OOC/status/2116154928033087526'),
  s('GTA1',11,'arkavx',80,true,'https://x.com/arkavx/status/2116146620580647228'),
  s('GTA1',12,'RStarUniverse',134,false,''),
  s('GTA1',13,'billsyliamgta',67,true,'https://x.com/billsyliamgta/status/2116219158211829872'),
  s('GTA2',9,'SeharShinwari',50,true,'https://x.com/SeharShinwari/status/2121429078301675935'),
  s('GTA2',10,'dfwpappy',70,true,'https://x.com/dfwpappy/status/2121433418970062983'),
  s('GTA2',11,'usamaworld1',40,true,'https://x.com/usamaworld1/status/2121433745597088155'),
  s('GTA2',12,'ZoeyBennettAi',90,true,'https://x.com/ZoeyBennettAi/status/2121433964179317108'),
  s('GTA2',13,'_YashalAli',60,true,'https://x.com/_YashalAli/status/2121434103320821894'),
  s('GTA2',14,'Riley11_AI',30,true,'https://x.com/Riley11_AI/status/2121434512022278590'),
  s('GTA2',15,'DoctorAmna11',80,true,'https://x.com/DoctorAmna11/status/2121434803321094488'),
  s('GTA2',16,'nusratsid1',70,true,'https://x.com/nusratsid1/status/2121435041247146458'),
  s('GTA2',17,'YaZoraiz',50,true,'https://x.com/YaZoraiz/status/2121435584497610953'),
  s('GTA2',18,'alzina3691',100,true,'https://x.com/alzina3691/status/2121436704535925195'),
  s('GTA2',19,'AlinaDavy20',100,false,''),
  s('GTA2',20,'The_Kremlinn',150,true,'https://x.com/the_kremlinn/status/2122051044737720371'),
  s('GTA2',21,'HeyToha',300,true,'https://x.com/HeyToha/status/2122020050635043050'),
  s('GTA2',22,'mikenevermiss',200,true,'https://x.com/mikenevermiss/status/2122204402345967860'),
  s('GTA2',35,'insomnia_vip',90,true,'https://x.com/insomnia_vip/status/2122261771100553517'),
  s('GTA2',38,'iluv_papi',100,true,'https://x.com/iluv_papi/status/2122103967551295552'),
];
export const seedVerifiedAt='2026-11-16';
