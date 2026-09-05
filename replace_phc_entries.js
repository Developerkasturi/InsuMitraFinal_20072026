const fs = require('fs');
const file = 'D:/Insumitra/InsuMitraFinal_20072026/Frontend/src/pages/Policies/PhcTrackingView.tsx';
let txt = fs.readFileSync(file, 'utf8');

const startIndex = txt.indexOf('{/* Multiple PHC Entries Section */}');
const endSearchStr = '              </div>\n            );\n          })}\n        </div>';
const endIndex = txt.indexOf(endSearchStr, startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find start or end index', startIndex, endIndex);
  process.exit(1);
}

const replacement = `{/* Multiple PHC Entries Section */}
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wide">PHC Transaction History</h4>
          </div>

          {['PENDING', 'BOOKED', 'COMPLETED', 'CANCELLED'].map(groupStatus => {
            const groupCheckups = (yr.allCheckups || []).filter((e: any) => e.status === groupStatus);
            if (groupCheckups.length === 0) return null;
            return (
              <div key={groupStatus} className="bg-white border border-slate-200/60 rounded-xl p-3 shadow-xs">
                <div className="flex flex-wrap items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                  <span className={clsx('w-2 h-2 rounded-full', 
                    groupStatus === 'COMPLETED' ? 'bg-emerald-500' :
                    groupStatus === 'CANCELLED' ? 'bg-slate-400' :
                    groupStatus === 'PENDING' ? 'bg-amber-500' : 'bg-blue-500'
                  )} />
                  <h5 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">{groupStatus}</h5>
                  <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded-md">{groupCheckups.length}</span>
                </div>
                
                <div className="space-y-3">
                  {groupCheckups.map((entry: any, index: number) => {
                    const globalIdx = index + 1;
                    return (
                      <div key={entry.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-3 relative shadow-sm">
                        <div className="flex items-center justify-between mb-1 pr-6">
                          <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Entry #{globalIdx}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Insured Person</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.member ? entry.member.name : 'Self'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">PHC Stage</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.status}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Booking Date</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.bookingDate ? new Date(entry.bookingDate).toLocaleDateString('en-GB') : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Appointment Date</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.scheduledAt ? new Date(entry.scheduledAt).toLocaleDateString('en-GB') : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Centre/Lab Name</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.centreName || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Centre/Lab City</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.centreCity || 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Utilized Amount</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.utilizedAmount ? (\`₹\` + entry.utilizedAmount.toLocaleString('en-IN')) : '₹0'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Report Received</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.completedAt ? new Date(entry.completedAt).toLocaleDateString('en-GB') : 'N/A'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Reimbursement or Cashless</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.reimbursementType || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>`;

txt = txt.substring(0, startIndex) + replacement + txt.substring(endIndex + endSearchStr.length);
fs.writeFileSync(file, txt);
console.log('REPLACED!');
