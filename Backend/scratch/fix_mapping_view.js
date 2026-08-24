const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Insurance/index.tsx');

if (!fs.existsSync(filepath)) {
  console.error("File does not exist: " + filepath);
  process.exit(1);
}

const content = fs.readFileSync(filepath, 'utf8');

const target = `              {/* 10. MAPPING */}
              {currentView === 'mapping' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Hospital & Doctor Mapping</h3>
                  <form onSubmit={(e) => { e.preventDefault(); toast.success('Mapping saved successfully (mock)'); setCurrentView('dashboard'); }} className="bg-white border border-slate-250/60 rounded-2xl p-6 space-y-4 max-w-lg shadow-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Select Doctor</label>
                        <select className="input text-xs" required>
                          <option>Dr. Rajesh Shah</option>
                          <option>Dr. Smita Patil</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Select Hospital</label>
                        <select className="input text-xs" required>
                          <option>Ruby Hall Clinic</option>
                          <option>KEM Hospital</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="btn-primary text-xs px-4 py-2 cursor-pointer">Create Map</button>
                  </form>
                </div>
              )}`;

const replacement = `              {/* 10. MAPPING */}
              {currentView === 'mapping' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Hospital List & Doctors Mapping</h3>
                    <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded-full">{hospitals.length} Hospitals</span>
                  </div>

                  {hospitals.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 italic text-xs">
                      No hospitals registered yet. Go back and click 'Add Hospital' to register hospitals.
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              <th className="p-3">Hospital Info</th>
                              <th className="p-3">Claims Department</th>
                              <th className="p-3">Doctors</th>
                              <th className="p-3">Comment</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {hospitals.map((h: any) => (
                              <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 space-y-1">
                                  <div className="font-bold text-slate-900">{h.name}</div>
                                  <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-2 gap-y-0.5">
                                    <span className={\`px-1.5 py-0.2 rounded-full font-bold \${
                                      h.type === 'Network' ? 'bg-emerald-50 text-emerald-600' :
                                      h.type === 'Blacklisted' ? 'bg-red-50 text-red-600' :
                                      'bg-slate-100 text-slate-600'
                                    }\`}>{h.type}</span>
                                    <span>{h.city}</span>
                                    {h.pincode && <span>- {h.pincode}</span>}
                                  </div>
                                  {h.phone && <div className="text-[10px] text-slate-500">📞 {h.phone}</div>}
                                  {h.address && <div className="text-[10px] text-slate-400 max-w-[200px] truncate" title={h.address}>{h.address}</div>}
                                </td>
                                <td className="p-3 space-y-1">
                                  {h.claimsPerson1Name && (
                                    <div className="text-[10px] text-slate-600">
                                      <span className="font-semibold">{h.claimsPerson1Name}</span>: {h.claimsPerson1Contact}
                                    </div>
                                  )}
                                  {h.claimsPerson2Name && (
                                    <div className="text-[10px] text-slate-600">
                                      <span className="font-semibold">{h.claimsPerson2Name}</span>: {h.claimsPerson2Contact}
                                    </div>
                                  )}
                                  {!h.claimsPerson1Name && !h.claimsPerson2Name && (
                                    <span className="text-slate-400 italic text-[10px]">Not Provided</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  {h.doctors && h.doctors.length > 0 ? (
                                    <div className="space-y-1 max-w-[220px]">
                                      {h.doctors.map((d: any, idx: number) => (
                                        <div key={d.id || idx} className="text-[10px] bg-slate-50 border border-slate-100 rounded-md p-1">
                                          <div className="font-bold text-slate-800">{d.name} <span className="text-[9px] font-normal text-slate-500">({d.degree})</span></div>
                                          <div className="text-slate-500">{d.specialty} {d.phone && \`· \${d.phone}\`}</div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[10px]">No Doctors Mapped</span>
                                  )}
                                </td>
                                <td className="p-3 text-[10px] text-slate-500 max-w-[150px] truncate" title={h.comment}>
                                  {h.comment || <span className="text-slate-300 italic">-</span>}
                                </td>
                                <td className="p-3 text-right">
                                  <button
                                    onClick={() => {
                                      if (confirm(\`Are you sure you want to delete \${h.name}?\`)) {
                                        removeHospitalMutation.mutate(h.id);
                                      }
                                    }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Hospital"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}`;

function clean(str) {
  return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

const cleanedContent = clean(content);
const cleanedTarget = clean(target);

if (cleanedContent.includes(cleanedTarget)) {
  const linesContent = content.split(/\r?\n/);
  const linesTarget = target.split(/\r?\n/).map(l => l.trim());

  let matchIdx = -1;
  for (let i = 0; i <= linesContent.length - linesTarget.length; i++) {
    let match = true;
    for (let j = 0; j < linesTarget.length; j++) {
      if (linesContent[i + j].trim() !== linesTarget[j]) {
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
    linesContent.splice(matchIdx, linesTarget.length, ...replacement.split('\n'));
    fs.writeFileSync(filepath, linesContent.join('\n'), 'utf8');
    console.log("Success replacing mapping view!");
  } else {
    console.error("Match index not found despite include check!");
    process.exit(1);
  }
} else {
  console.error("Cleaned target mapping view not found in cleaned content!");
  process.exit(1);
}
