// Versioned metadata in the existing 240-byte purpose field. No contract/schema changes.
export function encodeFund({title,purpose,description,merchantName}) {
 const values=[title,purpose,description,merchantName].map(value=>String(value||'').trim());
 return `PL1:${JSON.stringify(values)}`;
}
export function decodeFund(value) {
 if(value.startsWith('PL1:')) {
  try {
   const fields=JSON.parse(value.slice(4));
   if(Array.isArray(fields)&&fields.length===4&&fields.every(v=>typeof v==='string')&&fields[0].trim()) {
    const [title,purpose,description,merchantName]=fields;return {title,purpose,description,merchantName};
   }
  } catch { /* Legacy or malformed metadata remains visible as plain text. */ }
 }
 return {title:value,purpose:value,description:'',merchantName:''};
}
export const metadataBytes=value=>new TextEncoder().encode(value).length;
