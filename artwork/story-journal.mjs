import {dexId} from './campaign-world.mjs';

// Read-only native events; the caller supplies the project's event helpers.
export function storyJournal({IF,EX,say,shared}) {
  const entry=(goal,place,clue)=>[say([goal+'\n'+place,clue])];
  const own=dex=>{const i=dexId(dex)-1;return i<8?30+i:400+(i-8)*10;};
  const hall=entry('TALK TO OAK.','HALL OF FAME','NORTH OF BLUE,\nOAK WILL RECORD\nYOUR TEAM.');
  // Individual win flags survive a retreat. Only 195 tracks this attempt.
  const league=()=>shared('story_journal_league',[IF(195,'==',5,hall,[IF(195,'==',4,
    entry('CHALLENGE BLUE.','CHAMPION ROOM','BEYOND LANCE,\nBLUE WAITS WITH\nHIS FULL TEAM.'),[IF(195,'==',3,
    entry('CHALLENGE LANCE.','LANCES ROOM','BEYOND AGATHA,\nTHE DRAGON\nMASTER WAITS.'),[IF(195,'==',2,
    entry('CHALLENGE\nAGATHA.','AGATHAS ROOM','BEYOND BRUNO,\nGHOST POKEMON\nGUARD THE WAY.'),[IF(195,'==',1,
    entry('CHALLENGE BRUNO.','BRUNOS ROOM','BEYOND LORELEI,\nBRUNO TRAINS\nFIGHTING TYPES.'),
    entry('CHALLENGE\nLORELEI.','INDIGO PLATEAU','ASK THE\nATTENDANT. FACE\nLORELEI FIRST.'))])])])])]);

  const fuji=()=>shared('story_journal_fuji',[IF(197,'==',0,
    entry('DEFEAT THE\nTOWER ROCKET.','TOWER SUMMIT','CLIMB THE TOWER\nIN LAVENDER.\nMR FUJI IS HELD.'),
    entry('TALK TO MR FUJI.','TOWER SUMMIT','HE HAS A FLUTE\nFOR THE SLEEPER\nON ROUTE 12.'))]);
  // The bicycle makes Fuji optional for reaching Fuchsia.
  const inFuchsia=events=>[EX('$185$ == 1 || $206$ == 1',events,fuji())];
  const ranger=()=>shared('story_journal_ranger',entry('TALK TO THE\nSAFARI RANGER.','SAFARI LODGE','FUCHSIAS LODGE.\nTHE RANGER OPENS\nTHE SAFARI GATE.'));
  const strength=[IF(188,'==',1,
    entry('RETURN THE\nGOLD TEETH.','FUCHSIA WARDEN','THE WARDEN WILL\nTHANK YOU WITH\nHM STRENGTH.'),[IF(207,'==',0,ranger(),
    entry('FIND THE\nGOLD TEETH.','SAFARI EAST','SEARCH SAFARI\nEAST. THEN SEE\nFUCHSIAS WARDEN.'))])];
  const cut=[IF(157,'==',1,
    entry('MEET THE\nSHIP CAPTAIN.','S.S. ANNE','BOARD AT THE\nVERMILION DOCK.\nHE HAS HM CUT.'),[IF(263,'==',0,
    entry('BATTLE BLUE.','CERULEAN CITY','BLUE GUARDS THE\nNORTH EXIT TO\nNUGGET BRIDGE.'),[IF(155,'==',0,
    entry('DEFEAT THE\nBRIDGE ROCKET.','NUGGET BRIDGE','NORTH OF\nCERULEAN, BILL\nIS BEYOND HIM.'),
    entry('VISIT BILL.','BILLS COTTAGE','NORTH OF NUGGET\nBRIDGE, BILL HAS\nAN S.S. TICKET.'))])])];
  const switches=[IF(163,'==',0,
    entry('TURN ON THE\nFIRST SWITCH.','VERMILION GYM','THREE LOCKS.\nSTART WITH THE\nWESTERN SWITCH.'),[IF(163,'==',1,
    entry('TURN ON THE\nSECOND SWITCH.','VERMILION GYM','THE FIRST IS ON.\nTHE MIDDLE\nSWITCH IS NEXT.'),
    entry('TURN ON THE\nTHIRD SWITCH.','VERMILION GYM','TWO ARE ON.\nTHE EASTERN\nSWITCH IS LAST.'))])];
  const surge=[IF(158,'==',0,cut,[IF(163,'==',3,
    entry('CHALLENGE SURGE.','VERMILION GYM','THE THREE LOCKS\nARE OPEN. GROUND\nBEATS ELECTRIC.'),switches)])];
  const scope=[IF(160,'==',1,
    entry('DEFEAT GIOVANNI.','ROCKET HIDEOUT','THE LIFT KEY\nLEADS TO HIM.\nCLAIM THE SCOPE.'),[IF(170,'==',0,
    entry('DEFEAT THE\nROCKET GUARD.','ROCKET HIDEOUT','THE CELADON\nHIDEOUT GUARD\nHOLDS LIFT KEY.'),
    entry('TAKE THE\nLIFT KEY.','ROCKET HIDEOUT','THE GUARD FELL.\nTHE KEY IS IN\nTHE NORTHEAST.'))])];
  const silph=[IF(189,'==',1,[IF(210,'==',0,
    entry('BATTLE BLUE.','SILPH OFFICE','UNLOCK THE\nOFFICE WITH THE\nKEY. BLUE WAITS.'),
    entry('DEFEAT GIOVANNI.','SILPH OFFICE','BLUE YIELDED.\nFREE SILPH FROM\nTEAM ROCKET.'))],[IF(233,'==',0,
    entry('DEFEAT THE\nSCIENTIST.','SILPH LOBBY','EAST OF CELADON,\nROCKETS HOLD\nSAFFRONS SILPH.'),[IF(234,'==',0,
    entry('DEFEAT THE\nROCKET CAPTAIN.','SILPH RESEARCH','THE LOBBY LIFT\nLEADS UP TO THE\nCARD KEY GUARD.'),
    entry('TAKE THE\nCARD KEY.','SILPH RESEARCH','CAPTAIN FELL.\nTHE KEY IS IN\nTHE NORTHEAST.'))])])];
  // Pallet's sea route reaches Cinnabar without the Seafoam boulder.
  const blaine=[IF(191,'==',1,
    entry('CHALLENGE\nBLAINE.','CINNABAR GYM','THE SECRET KEY\nOPENS HIS GYM.\nUSE WATER TYPES.'),[IF(198,'==',0,
    entry('SEARCH THE\nSECRET STATUE.','POKEMON MANSION','SURF FROM PALLET\nTO CINNABAR. USE\nSTATUES SWITCH.'),
    entry('FIND THE\nSECRET KEY.','MANSION CELLAR','THE STATUE HAS\nOPENED THE WAY\nTO BLAINES KEY.'))])];

  const stages=[
    [12,entry('CHALLENGE BROCK.','PEWTER GYM','CROSS VIRIDIAN\nFOREST NORTH.\nUSE WATER TYPES.')],
    [153,entry('DEFEAT THE\nMOON ROCKET.','MT MOON','EAST OF PEWTER,\nROUTE 3 LEADS TO\nTHE SEALED CAVE.')],
    [150,entry('CHALLENGE MISTY.','CERULEAN GYM','BEYOND MT MOON,\nHER BADGE OPENS\nTHE ROAD SOUTH.')],
    [151,surge],
    [159,scope],
    [152,entry('CHALLENGE ERIKA.','CELADON GYM','GO THROUGH ROCK\nTUNNEL, LAVENDER\nAND ROUTE 8.')],
    [180,inFuchsia([IF(206,'==',1,
      entry('CHALLENGE KOGA.','FUCHSIA GYM','CYCLING ROAD\nLEADS SOUTH FROM\nCELADON TO HIM.'),
      entry('CHALLENGE KOGA.','FUCHSIA GYM','TAKE ROUTE 12\nFROM LAVENDER TO\nFUCHSIA SOUTH.'))])],
    [186,inFuchsia([IF(207,'==',0,ranger(),
      entry('MEET THE\nSURF KEEPER.','SAFARI LAKE','CROSS THE WEST\nAND EAST SAFARI.\nSEEK A LAKE HUT.'))])],
    [187,inFuchsia(strength)],
    [190,silph],
    [181,entry('CHALLENGE\nSABRINA.','SAFFRON GYM','SILPH IS FREE.\nKOGAS BADGE SAYS\nYOU ARE READY.')],
    [182,blaine],
    [183,entry('CHALLENGE\nGIOVANNI.','VIRIDIAN GYM','AFTER BLAINE,\nVIRIDIANS LEADER\nHAS RETURNED.')],
    [211,entry('BATTLE BLUE.','ROUTE 22','WEST OF VIRIDIAN\nBLUE GUARDS THE\nLEAGUE APPROACH.')],
    [199,entry('PUSH THE\nFIRST BOULDER.','VICTORY ROAD','NORTH OF ROUTE\n22, USE STRENGTH\nON THE SWITCH.')],
    [200,entry('PUSH THE\nSECOND BOULDER.','VICTORY SUMMIT','CLIMB VICTORY\nROAD. PUSH THE\nLAST BOULDER.')]
  ];
  // Group gates so a late objective does not consume a call frame per quest.
  let campaign=league();
  for(let end=stages.length;end>0;end-=4){
    const start=Math.max(0,end-4);
    campaign=shared('story_journal_stage_'+start,stages.slice(start,end).reduceRight(
      (next,[flag,events])=>[IF(flag,'==',0,events,next)],campaign));
  }

  const discoveries=[
    [own(150),entry('SEEK MEWTWO.','CERULEAN CAVE','EAST OF CERULEAN\nTHE CAVE ADMITS\nHALL OF FAMERS.')],
    [own(145),entry('SEEK ZAPDOS.','POWER PLANT','SURF EAST FROM\nROUTE 9 TO THE\nABANDONED PLANT.')],
    [own(144),[IF(192,'==',0,
      entry('MOVE THE\nSEAFOAM BOULDER.','SEAFOAM ISLANDS','SURF SOUTH FROM\nFUCHSIA. USE\nSTRENGTH HERE.'),
      entry('SEEK ARTICUNO.','SEAFOAM DEPTHS','THE SLOW CURRENT\nADMITS YOU. THE\nICE BIRD WAITS.'))]],
    [own(146),entry('SEEK MOLTRES.','VICTORY SUMMIT','RETURN TO THE\nSUMMIT. THE FIRE\nBIRD AWAITS YOU.')]
  ];
  const collection=[IF(own(151),'==',1,
    entry('FIND THE MISSING\nPOKEMON.','KANTO','RECORD ALL 151.\nOAKS RESERVE HAS\nRARE SPECIES.'),[IF(10,'<',100,
    entry('FIND NEW\nPOKEMON.','KANTO ROUTES','MEW AWAITS 100\nPOKEDEX ENTRIES\nIN OAKS RESERVE.'),
    entry('SEEK MEW.','OAKS RESERVE','WEST OF PALLET,\nMEW AWAITS YOUR\n100 ENTRIES.'))])];
  const postgame=shared('story_journal_postgame',[IF(10,'>=',151,
    entry('VISIT OAK.','PALLET LAB','ALL 151 SPECIES\nARE RECORDED.\nSHARE THE NEWS.'),
    discoveries.reduceRight((next,[flag,events])=>[IF(flag,'==',0,events,next)],collection))]);

  const parcel=[IF(247,'==',1,
    entry('DELIVER OAKS\nPARCEL.','PALLET LAB','FOLLOW ROUTE 1\nSOUTH. OAK HAS\nYOUR POKEDEX.'),[EX('$1$ == 0 && $27$ == 0',[IF(246,'==',0,
    entry('TALK TO OAK.','PALLET LAB','HIS LAB IS SOUTH\nOF HOME, BESIDE\nTHE WATER.'),
    entry('CHOOSE YOUR\nFIRST PARTNER.','PALLET LAB','THREE POKE BALLS\nWAIT ON OAKS\nTABLE.'))],[IF(26,'==',0,
    entry('BATTLE BLUE.','PALLET LAB','YOUR NEW PARTNER\nIS READY. BLUE\nWAITS AT EXIT.'),
    entry('COLLECT OAKS\nPARCEL.','VIRIDIAN MART','FOLLOW ROUTE 1\nNORTH. THE CLERK\nHAS OAKS PARCEL.'))])])];
  return shared('story_journal',[IF(220,'==',1,postgame,[IF(248,'==',0,parcel,
    [EX('$195$ >= 1 && $195$ <= 5',league(),campaign)])])]);
}
