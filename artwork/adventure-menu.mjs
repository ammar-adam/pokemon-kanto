// Pack file number (ones) and text pace (tens) into the existing startup variable.
export function adventureMenu({E,IF,EX,V,set,math,say,menu,label,go,shared,hide,switchScene}) {
  const slots=[0,1,2];
  const has=(slot,yes,no=[])=>E('EVENT_IF_SAVED_DATA',{saveSlot:slot},{true:yes,false:no});
  const pace=speed=>E('EVENT_TEXT_SET_ANIMATION_SPEED',{speedIn:0,speedOut:0,speed,allowFastForward:true});
  const applyPace=()=>shared('apply_text_pace',[
    IF(22,'>=',20,[pace(0)],[IF(22,'>=',10,[pace(1)],[pace(3)])])
  ]);
  const options=(cancel=true)=>[
    say('TEXT SPEED'),menu(13,['FAST','NORMAL','INSTANT'],cancel),
    IF(13,'>',0,[math(22,'mod',10),IF(13,'==',1,[math(22,'add',10)]),IF(13,'==',3,[math(22,'add',20)]),...applyPace()])
  ];
  const chooseFile=()=>menu(307,['FILE 1','FILE 2','FILE 3','BACK']);
  const peek=(slot,source,dest)=>E('EVENT_PEEK_DATA',{saveSlot:slot,variableSource:String(source),variableDest:String(dest)});
  const preview=slot=>[
    peek(slot,10,16),set(308,0),
    ...[12,150,151,152,180,181,182,183].flatMap(v=>[peek(slot,v,309),math(308,'add',309,'var')]),
    say(`FILE ${slot+1} - RED\nBADGES $308$/8\nPOKEDEX $16$/151`)
  ];
  const writeSlot=slot=>shared('write_file_'+slot,[
    math(22,'div',10),math(22,'mul',10),math(22,'add',slot+1),
    E('EVENT_SAVE_DATA',{saveSlot:slot},{true:[say(`SAVED TO FILE ${slot+1}.`)],load:applyPace()})
  ]);
  const save=()=>shared('save_files',[
    set(135,V(22)),math(135,'mod',10),say('SAVE YOUR GAME?\nCURRENT FILE $135$'),chooseFile(),
    ...slots.map(slot=>IF(307,'==',slot+1,shared('confirm_file_'+slot,[
      has(slot,[say(`FILE ${slot+1} HAS A\nSAVED ADVENTURE.\nREPLACE IT?`),menu(13,['KEEP FILE','OVERWRITE']),IF(13,'==',2,writeSlot(slot))],
        [say(`SAVE TO FILE ${slot+1}?`),menu(13,['SAVE','CANCEL']),IF(13,'==',1,writeSlot(slot))])
    ])))
  ])[0];
  const begin=slot=>shared('begin_file_'+slot,[
    E('EVENT_RESET_VARIABLES'),set(22,slot+1),set(0,5),set(133,3000),
    ...options(false),
    say(['OAK: WELCOME TO\nTHE WORLD OF\nPOKEMON!','PEOPLE AND\nPOKEMON SHARE\nTHIS WORLD.','RED, YOUR STORY\nBEGINS AT HOME\nIN PALLET TOWN.']),
    switchScene('red_house',9,13)
  ]);
  const title=()=>[
    hide('player'),E('EVENT_REMOVE_INPUT_SCRIPT',{input:['start','select']}),pace(1),
    label('title_menu'),menu(13,['NEW GAME','CONTINUE'],false),
    IF(13,'==',1,shared('new_adventure',[
      say('CHOOSE YOUR FILE.'),chooseFile(),
      ...slots.map(slot=>IF(307,'==',slot+1,shared('new_file_'+slot,[
        has(slot,[say(`FILE ${slot+1} IS IN USE.\nIT STAYS UNTIL\nYOU SAVE OVER IT.`),menu(13,['KEEP FILE','NEW ADVENTURE']),IF(13,'==',2,begin(slot))],begin(slot))
      ]))),set(13,0)
    ])),
    IF(13,'==',2,shared('continue_adventure',[
      chooseFile(),...slots.map(slot=>IF(307,'==',slot+1,shared('load_file_'+slot,[
        has(slot,[...preview(slot),menu(13,['CONTINUE','BACK']),IF(13,'==',1,[E('EVENT_LOAD_DATA',{saveSlot:slot})])],
          [say(`FILE ${slot+1} IS EMPTY.`)])
      ])))
    ])),go('title_menu')
  ];
  return {save,title,options:()=>shared('adventure_options',options())};
}
