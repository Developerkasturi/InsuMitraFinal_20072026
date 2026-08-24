const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Claims/index.tsx');

if (!fs.existsSync(filepath)) {
  console.error("File does not exist: " + filepath);
  process.exit(1);
}

let content = fs.readFileSync(filepath, 'utf8');

// Helper to replace text ignoring CRLF issues
function replaceText(src, tgt, rpl) {
  const cleanStr = (s) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const srcClean = cleanStr(src);
  const tgtClean = cleanStr(tgt);
  if (srcClean.includes(tgtClean)) {
    // Exact replacement via line splitting
    const lines = src.split(/\r?\n/);
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

// 1. Update hospitals useMemo / useQuery to load from API
const targetHospQuery = `  const { data: companiesRes } = useQuery({
    queryKey: ['insurance-companies-for-hospitals'],
    queryFn: () => insuranceService.listCompanies(),
  });
  const hospitals = useMemo(() => {
    if (!companiesRes?.data) return [];
    return companiesRes.data.flatMap((c: any) => {
      if (c.notes && c.notes.trim().startsWith('{')) {
        try {
          return JSON.parse(c.notes).hospitals || [];
        } catch { return []; }
      }
      return [];
    });
  }, [companiesRes?.data]);`;

const rplHospQuery = `  const { data: hospitalsRes } = useQuery({
    queryKey: ['hospitals-list'],
    queryFn: () => insuranceService.listHospitals(),
  });
  const hospitals = useMemo(() => {
    return hospitalsRes?.data ?? [];
  }, [hospitalsRes?.data]);`;

const res1 = replaceText(content, targetHospQuery, rplHospQuery);
if (res1) {
  content = res1;
  console.log("1. Updated hospitals query.");
} else {
  console.error("1. Failed to update hospitals query!");
  process.exit(1);
}

// 2. Remove State & Rating fields from edit claim notes form
const targetEditStateRating = `                  <div>
                    <label className="label text-[10px]">Hospital State</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={hospitalState} onChange={e => setHospitalState(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Hospital City</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={hospitalCity} onChange={e => setHospitalCity(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Hospital Pincode</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={hospitalPincode} onChange={e => setHospitalPincode(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Hospital Contact No</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={hospitalContactNo} onChange={e => setHospitalContactNo(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Hospital Rating</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={hospitalRating} onChange={e => setHospitalRating(e.target.value)} />
                  </div>`;

const rplEditStateRating = `                  <div>
                    <label className="label text-[10px]">Hospital City</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={hospitalCity} onChange={e => setHospitalCity(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Hospital Pincode</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={hospitalPincode} onChange={e => setHospitalPincode(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Hospital Contact No</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={hospitalContactNo} onChange={e => setHospitalContactNo(e.target.value)} />
                  </div>`;

const res2 = replaceText(content, targetEditStateRating, rplEditStateRating);
if (res2) {
  content = res2;
  console.log("2. Removed state & rating from edit notes form.");
} else {
  console.error("2. Failed to remove state & rating from edit notes form!");
  process.exit(1);
}

// 3. Update Doctor Degree to a select dropdown in edit notes form
const targetEditDocDegree = `                      <div>
                        <label className="label text-[10px]">Doctor Degree</label>
                        <input value={doc.degree} onChange={e => handleDoctorChange(index, 'degree', e.target.value)} className="input mt-1 py-1 text-xs" />
                      </div>`;

const rplEditDocDegree = `                      <div>
                        <label className="label text-[10px]">Doctor Degree</label>
                        <select
                          value={doc.degree}
                          onChange={e => handleDoctorChange(index, 'degree', e.target.value)}
                          className="input mt-1 py-1 text-xs"
                        >
                          <option value="">Select Degree</option>
                          {['MBBS', 'MD', 'MS', 'DM', 'MCh', 'DNB', 'BDS', 'MDS'].map(deg => (
                            <option key={deg} value={deg}>{deg}</option>
                          ))}
                        </select>
                      </div>`;

const res3 = replaceText(content, targetEditDocDegree, rplEditDocDegree);
if (res3) {
  content = res3;
  console.log("3. Updated doctor degree select in edit notes.");
} else {
  console.error("3. Failed to update doctor degree select in edit notes!");
  process.exit(1);
}

// 4. Change City dropdown to a free-text input field in the new claim wizard
const targetWizardCity = `                        <div>
                          <label className="label text-[10px]">Hospital City</label>
                          <select 
                            className="input mt-1 py-1 text-xs" 
                            {...register('hospitalCity')}
                            onChange={(e) => {
                              setValue('hospitalCity', e.target.value);
                              setValue('hospitalName', '');
                              setValue('hospitalAddress', '');
                              setValue('hospitalState', '');
                              setValue('hospitalPincode', '');
                              setValue('hospitalContactNo', '');
                              setValue('hospitalRating', '');
                              setValue('hospitalType', '');
                            }}
                          >
                            <option value="">Select City</option>
                            {Array.from(new Set(hospitals.map((h: any) => h.hospitalCity).filter(Boolean))).map((c: any) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>`;

const rplWizardCity = `                        <div>
                          <label className="label text-[10px]">Hospital City</label>
                          <input
                            type="text"
                            className="input mt-1 py-1 text-xs"
                            {...register('hospitalCity')}
                            placeholder="e.g. Pune"
                          />
                        </div>`;

const res4 = replaceText(content, targetWizardCity, rplWizardCity);
if (res4) {
  content = res4;
  console.log("4. Updated City select to text input in wizard.");
} else {
  console.error("4. Failed to update City select in wizard!");
  process.exit(1);
}

// 5. Update Hospital Select dropdown mapping (supporting name/hospitalName and city/hospitalCity)
const targetWizardHospSelect = `                          <select 
                            className="input mt-1 py-1 text-xs" 
                            {...register('hospitalName')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setValue('hospitalName', val);
                              const hosp = hospitals.find((h: any) => h.hospitalName === val);
                              if (hosp) {
                                if (!watchHospitalCity) setValue('hospitalCity', hosp.hospitalCity);
                                setValue('hospitalAddress', ''); // Store doesn't have precise address line, leave blank or we could map from city
                                setValue('hospitalState', hosp.hospitalState);
                                setValue('hospitalPincode', hosp.hospitalPincode);
                                setValue('hospitalContactNo', hosp.hospitalContactNo);
                                setValue('hospitalRating', hosp.hospitalRating);
                                setValue('hospitalType', hosp.hospitalType);
                              }
                            }}
                          >
                            <option value="">Select Hospital</option>
                            {hospitals.filter((h: any) => !watchHospitalCity || h.hospitalCity === watchHospitalCity).map((h: any) => (
                              <option key={h.id} value={h.hospitalName}>{h.hospitalName}</option>
                            ))}
                          </select>`;

const rplWizardHospSelect = `                          <select 
                            className="input mt-1 py-1 text-xs" 
                            {...register('hospitalName')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setValue('hospitalName', val);
                              const hosp = hospitals.find((h: any) => h.name === val || h.hospitalName === val);
                              if (hosp) {
                                setValue('hospitalCity', hosp.city || hosp.hospitalCity || '');
                                setValue('hospitalAddress', hosp.address || hosp.hospitalAddress || '');
                                setValue('hospitalPincode', hosp.pincode || hosp.hospitalPincode || '');
                                setValue('hospitalContactNo', hosp.phone || hosp.hospitalContactNo || '');
                                setValue('hospitalType', hosp.type || hosp.hospitalType || '');
                                setValue('claimsPerson1Name', hosp.claimsPerson1Name || '');
                                setValue('claimsPerson1Contact', hosp.claimsPerson1Contact || '');
                                setValue('claimsPerson2Name', hosp.claimsPerson2Name || '');
                                setValue('claimsPerson2Contact', hosp.claimsPerson2Contact || '');
                                setValue('hospitalComment', hosp.comment || hosp.hospitalComment || '');
                              }
                            }}
                          >
                            <option value="">Select Hospital</option>
                            {hospitals.filter((h: any) => !watchHospitalCity || (h.city || h.hospitalCity) === watchHospitalCity).map((h: any) => (
                              <option key={h.id} value={h.name || h.hospitalName}>{h.name || h.hospitalName}</option>
                            ))}
                          </select>`;

const res5 = replaceText(content, targetWizardHospSelect, rplWizardHospSelect);
if (res5) {
  content = res5;
  console.log("5. Updated Hospital Select dropdown logic.");
} else {
  console.error("5. Failed to update Hospital Select dropdown logic!");
  process.exit(1);
}

// 6. Remove Rating field from wizard form
const targetWizardRating = `                        <div>
                          <label className="label text-[10px]">Hospital Rating</label>
                          <input type="text" className="input mt-1 py-1 text-xs" {...register('hospitalRating')} />
                        </div>`;

const rplWizardRating = ``;

const res6 = replaceText(content, targetWizardRating, rplWizardRating);
if (res6) {
  content = res6;
  console.log("6. Removed rating from wizard form.");
} else {
  console.error("6. Failed to remove rating from wizard form!");
  process.exit(1);
}

// 7. Update doctor degree select inside new doctor rows
const targetWizardDocDegree = `                            <div>
                              <label className="label text-[10px]">Doctor Degree</label>
                              <input value={doc.degree} onChange={e => handleNewDoctorChange(index, 'degree', e.target.value)} className="input mt-1 py-1 text-xs" />
                            </div>`;

const rplWizardDocDegree = `                            <div>
                              <label className="label text-[10px]">Doctor Degree</label>
                              <select
                                value={doc.degree}
                                onChange={e => handleNewDoctorChange(index, 'degree', e.target.value)}
                                className="input mt-1 py-1 text-xs"
                              >
                                <option value="">Select Degree</option>
                                {['MBBS', 'MD', 'MS', 'DM', 'MCh', 'DNB', 'BDS', 'MDS'].map(deg => (
                                  <option key={deg} value={deg}>{deg}</option>
                                ))}
                              </select>
                            </div>`;

const res7 = replaceText(content, targetWizardDocDegree, rplWizardDocDegree);
if (res7) {
  content = res7;
  console.log("7. Updated doctor degree to select in new doctor wizard rows.");
} else {
  console.error("7. Failed to update doctor degree select in wizard!");
  process.exit(1);
}

// 8. Update Doctors List selection triggers to support both doctors / hospitalDoctors model arrays
const targetDocListTgrs = [
  {
    tgt: `hospitals.find((h: any) => h.hospitalName === watchHospitalName)?.hospitalDoctors?.length`,
    rpl: `(hospitals.find((h: any) => h.name === watchHospitalName || h.hospitalName === watchHospitalName)?.doctors?.length ?? hospitals.find((h: any) => h.name === watchHospitalName || h.hospitalName === watchHospitalName)?.hospitalDoctors?.length)`
  },
  {
    tgt: `(hospitals.find((h: any) => h.hospitalName === watchHospitalName)?.hospitalDoctors || [])`,
    rpl: `(hospitals.find((h: any) => h.name === watchHospitalName || h.hospitalName === watchHospitalName)?.doctors || hospitals.find((h: any) => h.name === watchHospitalName || h.hospitalName === watchHospitalName)?.hospitalDoctors || [])`
  }
];

let replacedTgrs = 0;
for (const item of targetDocListTgrs) {
  // Use simple replace for short, single-line snippets
  while (content.includes(item.tgt)) {
    content = content.replace(item.tgt, item.rpl);
    replacedTgrs++;
  }
}
console.log(`8. Replaced ${replacedTgrs} doctor list trigger expressions.`);

fs.writeFileSync(filepath, content, 'utf8');
console.log("Success updating Claims page index.tsx!");
