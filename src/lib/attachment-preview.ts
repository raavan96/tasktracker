// File content, not a supplied extension or MIME label, determines preview type.
export function previewMime(bytes:Uint8Array):string|null{
 const head=String.fromCharCode(...bytes.slice(0,16));
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(head.startsWith('GIF87a')||head.startsWith('GIF89a'))return 'image/gif';
 if(head.startsWith('RIFF')&&head.slice(8,12)==='WEBP')return 'image/webp';
 if(head.startsWith('%PDF-'))return 'application/pdf';return null;
}
