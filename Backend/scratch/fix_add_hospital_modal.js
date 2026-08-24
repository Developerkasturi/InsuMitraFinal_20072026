const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Insurance/index.tsx');

if (!fs.existsSync(filepath)) {
  console.error("File does not exist: " + filepath);
  process.exit(1);
}

const content = fs.readFileSync(filepath, 'utf8');

// We will find the range of the Add Hospital Modal and replace it.
const modalStartToken = `      {/* ── Add Hospital Modal ──────────────────────────────────────────────── */}`;
const modalEndToken = `      {/* ── Add Agent Modal ─────────────────────────────────────────────────── */}`;

const startIdx = content.indexOf(modalStartToken);
const endIdx = content.indexOf(modalEndToken);

if (startIdx === -1 || endIdx === -1) {
  console.error("Tokens not found in file!");
  process.exit(1);
}

const beforeModal = content.substring(0, startIdx);
const afterModal = content.substring(endIdx);

const newModalCode = `      {/* ── Add Hospital Modal ──────────────────────────────────────────────── */}
      <Modal
        open={hospitalModal}
        onClose={() => {
          setHospitalModal(false);
          setHospitalForm({
            name: '',
            address: '',
            city: '',
            pincode: '',
            contactNo: '',
            type: 'Network',
            claimsPerson1Name: '',
            claimsPerson1Contact: '',
            claimsPerson2Name: '',
            claimsPerson2Contact: '',
            comment: ''
          });
          setHospitalDoctors([]);
        }}
        title="Add Hospital"
        actions={
          <button type="submit" form="hospital-form" className="btn-primary py-1.5 px-4 text-xs cursor-pointer shadow-md shadow-primary-500/20 rounded-xl" disabled={createHospitalMutation.isPending}>
            {createHospitalMutation.isPending ? 'Saving...' : 'Save Hospital'}
          </button>
        }
        size="3xl"
      >
        {(() => {
          const DOCTOR_DEGREES = ['MBBS', 'MD', 'MS', 'DM', 'MCh', 'DNB', 'BDS', 'MDS'];

          const handleAddDoctor = () => {
            setHospitalDoctors(prev => [
              ...prev,
              {
                id: \`doc-\${Date.now()}-\${Math.random()}\`,
                name: '',
                degree: '',
                contactNo: '',
                speciality: ''
              }
            ]);
          };

          const handleRemoveDoctor = (id: string) => {
            setHospitalDoctors(prev => prev.filter(doc => doc.id !== id));
          };

          const handleUpdateDoctor = (id: string, field: string, value: string) => {
            setHospitalDoctors(prev => prev.map(doc => {
              if (doc.id === id) {
                return { ...doc, [field]: value };
              }
              return doc;
            }));
          };

          const handleFormSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            createHospitalMutation.mutate({
              ...hospitalForm,
              doctors: hospitalDoctors
            });
          };

          return (
            <form id="hospital-form" onSubmit={handleFormSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {/* Section 1: Hospital Details */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1.5">
                  1. Hospital Details
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hospital Name *</label>
                    <input
                      type="text"
                      required
                      value={hospitalForm.name}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, name: e.target.value }))}
                      className="input text-xs"
                      placeholder="e.g. Ruby Hall Clinic"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hospital Type *</label>
                    <select
                      value={hospitalForm.type}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, type: e.target.value }))}
                      className="input text-xs"
                      required
                    >
                      <option value="Network">Network</option>
                      <option value="Non-Network">Non-Network</option>
                      <option value="Blacklisted">Blacklisted</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hospital City *</label>
                    <input
                      type="text"
                      required
                      value={hospitalForm.city}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, city: e.target.value }))}
                      className="input text-xs"
                      placeholder="e.g. Pune"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hospital Pincode *</label>
                    <input
                      type="text"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={hospitalForm.pincode}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, pincode: e.target.value.replace(/\\D/g, '') }))}
                      className="input text-xs"
                      placeholder="e.g. 411001"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hospital Contact No *</label>
                    <input
                      type="text"
                      maxLength={15}
                      required
                      value={hospitalForm.contactNo}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, contactNo: e.target.value.replace(/\\D/g, '') }))}
                      className="input text-xs"
                      placeholder="e.g. 9876543210"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hospital Address</label>
                    <input
                      type="text"
                      value={hospitalForm.address}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, address: e.target.value }))}
                      className="input text-xs"
                      placeholder="e.g. 40, Bund Garden Road, Pune"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Claims Department Person 1 Name</label>
                    <input
                      type="text"
                      value={hospitalForm.claimsPerson1Name}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, claimsPerson1Name: e.target.value }))}
                      className="input text-xs"
                      placeholder="e.g. Ramesh Patil"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Claims Person 1 Contact No</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={hospitalForm.claimsPerson1Contact}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, claimsPerson1Contact: e.target.value.replace(/\\D/g, '') }))}
                      className="input text-xs"
                      placeholder="e.g. 9876543210"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Claims Department Person 2 Name</label>
                    <input
                      type="text"
                      value={hospitalForm.claimsPerson2Name}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, claimsPerson2Name: e.target.value }))}
                      className="input text-xs"
                      placeholder="e.g. Suresh Shinde"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Claims Person 2 Contact No</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={hospitalForm.claimsPerson2Contact}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, claimsPerson2Contact: e.target.value.replace(/\\D/g, '') }))}
                      className="input text-xs"
                      placeholder="e.g. 9876543211"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Comment</label>
                  <textarea
                    value={hospitalForm.comment}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, comment: e.target.value }))}
                    className="input text-xs min-h-[60px] py-2"
                    placeholder="Add any extra notes here..."
                  />
                </div>
              </div>

              {/* Section 2: Doctor Details */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    2. Doctor Details
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddDoctor}
                    className="text-[10px] sm:text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Add Doctor
                  </button>
                </div>

                {hospitalDoctors.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No doctors mapped yet. Click 'Add Doctor' to map doctors to this hospital.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {hospitalDoctors.map((doc, index) => (
                      <div key={doc.id} className="relative border border-slate-200 rounded-xl p-3 bg-white space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Doctor #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDoctor(doc.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Remove Doctor"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Doctor Name *</label>
                            <input
                              type="text"
                              required
                              value={doc.name}
                              onChange={(e) => handleUpdateDoctor(doc.id, 'name', e.target.value)}
                              className="input text-xs py-1"
                              placeholder="e.g. Dr. Rajesh Shah"
                            />
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Doctor Degree *</label>
                            <select
                              required
                              value={doc.degree}
                              onChange={(e) => handleUpdateDoctor(doc.id, 'degree', e.target.value)}
                              className="input text-xs py-1"
                            >
                              <option value="">Select Degree</option>
                              {DOCTOR_DEGREES.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Contact No *</label>
                            <input
                              type="text"
                              maxLength={15}
                              required
                              value={doc.contactNo}
                              onChange={(e) => handleUpdateDoctor(doc.id, 'contactNo', e.target.value.replace(/\\D/g, ''))}
                              className="input text-xs py-1"
                              placeholder="e.g. 9876543210"
                            />
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Speciality *</label>
                            <input
                              type="text"
                              required
                              value={doc.speciality}
                              onChange={(e) => handleUpdateDoctor(doc.id, 'speciality', e.target.value)}
                              className="input text-xs py-1"
                              placeholder="e.g. Cardiology"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>
          );
        })()}
      </Modal>

`;

const finalContent = beforeModal + newModalCode + afterModal;
fs.writeFileSync(filepath, finalContent, 'utf8');
console.log("Success updating Add Hospital Modal!");
