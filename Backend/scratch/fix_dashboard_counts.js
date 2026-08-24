const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Insurance/index.tsx');

if (!fs.existsSync(filepath)) {
  console.error("File does not exist: " + filepath);
  process.exit(1);
}

let content = fs.readFileSync(filepath, 'utf8');

// 1. Inject totalDoctors computation after hospitals definition
const targetMemo = `  const hospitals = useMemo(() => {
    return hospitalsRes?.data ?? [];
  }, [hospitalsRes?.data]);`;

const replacementMemo = `  const hospitals = useMemo(() => {
    return hospitalsRes?.data ?? [];
  }, [hospitalsRes?.data]);

  const totalDoctors = useMemo(() => {
    return hospitals.reduce((sum, h) => sum + (h.doctors?.length || 0), 0);
  }, [hospitals]);`;

if (content.includes(targetMemo)) {
  content = content.replace(targetMemo, replacementMemo);
  console.log("Injected totalDoctors computation successfully.");
} else {
  console.error("Could not find hospitals memo hook!");
  process.exit(1);
}

// 2. Replace hardcoded dashboard counts
const targetHospCount = `<p className="text-lg font-black text-slate-950">125</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Total Hospitals</p>`;
const replacementHospCount = `<p className="text-lg font-black text-slate-950">{hospitals.length}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Total Hospitals</p>`;

const targetDocCount = `<p className="text-lg font-black text-slate-950">350</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Total Doctors</p>`;
const replacementDocCount = `<p className="text-lg font-black text-slate-950">{totalDoctors}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Total Doctors</p>`;

// Helper function to replace ignoring spacing/newlines
function replaceFlexible(text, tgt, rpl) {
  const cleanStr = (s) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
  const cleanText = cleanStr(text);
  const cleanTgt = cleanStr(tgt);
  if (cleanText.includes(cleanTgt)) {
    const lines = text.split(/\r?\n/);
    const linesTgt = tgt.split(/\r?\n/).map(l => l.trim());
    let matchIdx = -1;
    for (let i = 0; i <= lines.length - linesTgt.length; i++) {
      let match = true;
      for (let j = 0; j < linesTgt.length; j++) {
        if (lines[i + j].trim() !== linesTgt[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        matchIdx = i;
        break;
      }
    }
    if (matchIdx !== -1) {
      lines.splice(matchIdx, linesTgt.length, ...rpl.split('\n'));
      return lines.join('\n');
    }
  }
  return null;
}

const resHosp = replaceFlexible(content, targetHospCount, replacementHospCount);
if (resHosp) {
  content = resHosp;
  console.log("Replaced hospitals dashboard count successfully.");
} else {
  console.error("Could not find hospitals count dashboard section!");
  process.exit(1);
}

const resDoc = replaceFlexible(content, targetDocCount, replacementDocCount);
if (resDoc) {
  content = resDoc;
  console.log("Replaced doctors dashboard count successfully.");
} else {
  console.error("Could not find doctors count dashboard section!");
  process.exit(1);
}

fs.writeFileSync(filepath, content, 'utf8');
console.log("Success updating dashboard counts!");
