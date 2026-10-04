// Read the official engine's linked save_points table, without running the ROM.
export function inspectSaveLayout(rom,symbols) {
  const address=symbols._save_points;
  if(!Number.isInteger(address)||address<0x10000)throw new Error('Missing linked save table');
  let cursor=(address>>>16)*0x4000+(address&0x3fff);
  const bankEnd=((address>>>16)+1)*0x4000,points=[];
  let bytesPerFile=6,terminated=false;
  for(let i=0;i<32;i++,cursor+=5){
    if(cursor+5>Math.min(bankEnd,rom.length))throw new Error('Save table leaves its ROM bank');
    const target=rom.readUInt16LE(cursor);
    if(!target){terminated=true;break;}
    const size=rom.readUInt16LE(cursor+2),id=rom[cursor+4];
    if(target<0xc000||target+size>0xe000||!size||id!==i)throw new Error('Unexpected save block layout');
    points.push({id,size});bytesPerFile+=size+3;
  }
  if(!terminated||points.length!==23||points[0].size!==4096)throw new Error('Unexpected native save schema');
  const ramBytes=({2:8192,3:32768,4:131072,5:65536})[rom[0x149]];
  if(!ramBytes||bytesPerFile>8192)throw new Error('Save file exceeds a cartridge RAM bank');
  const files=Array.from({length:3},(_,slot)=>({slot:slot+1,bank:slot,offset:slot*8192,sizeBytes:bytesPerFile}));
  if(files.at(-1).offset+bytesPerFile>ramBytes)throw new Error('Three save files exceed cartridge RAM');
  return {fileCount:3,bytesPerFile,ramBytes,files,points,runtimePersistenceVerified:false};
}
