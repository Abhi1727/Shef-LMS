/**
 * Add students to a batch.
 * Creates new users if they don't exist, or updates batchId for existing users.
 * Default password for new users: Student@123 (change after first login)
 *
 * Usage: node scripts/addStudentsToBatch.js [BATCH_NAME]
 * Example: node scripts/addStudentsToBatch.js BATCH-07029091DS&AI
 */

const bcrypt = require('bcryptjs');
const { connectMongo } = require('../config/mongo');
const User = require('../models/User');
const Batch = require('../models/Batch');

const BATCH_NAME = process.argv[2] || 'BATCH-31018080CS&EH';

const STUDENT_LISTS = {
  'BATCH-31018080CS&EH': [
    { name: 'Diane McKinzy', emails: ['businessmatters1977@gmail.com', 'Greatnesstravel@gmail.com'] },
    { name: 'Bernard Boadu', emails: ['bboadu@gmail.com'] },
    { name: 'Mahmudul Alam', emails: ['onquer@gmail.com'] },
    { name: 'Dominic Ellis', emails: ['dmanellis@gmail.com'] },
    { name: 'Sandhya Sivakumar', emails: ['sandhyasivakumar15@gmail.com'] },
    { name: 'Fabrice Wouafeu Tchotcheu', emails: ['Fabricewouaf@gmail.com'] },
    { name: 'Samim Iqbal', emails: ['Miqbal78.pe@gmail.com'] },
    { name: 'cesar melgarejo villanueva', emails: ['juliusces@aol.com', 'cesarmvillanueva@gmail.com'] },
    { name: 'Gbenga Owadokun', emails: ['oloritemi@yahoo.co.uk'] },
    { name: 'Eric illa Hutchins', emails: ['Manifest379@gmail.com'] },
    { name: 'Yashmine ove', emails: ['yazoveras@gmail.com'] },
  ],
  'BATCH-07029091DS&AI': [
    { name: 'Charles N Fru', emails: ['frucharles1994@gmail.com'] },
    { name: 'Shafiqullah Salarzai', emails: ['Salarzaishafiqullah@gmail.com', 'mushfi.qmcs@gmail.com'] },
    { name: 'Mark Dudinski', emails: ['medudinski@gmail.com'] },
    { name: 'Joseph McElprang', emails: ['joseph.mcelprang@gmail.com'] },
    { name: 'Christopher Brown', emails: ['Mr.CHBrown2@outlook.com'] },
    { name: 'Henry Sufran', emails: ['hsufran@me.com'] },
    { name: 'Charli Massicka', emails: ['cmassicka@gmail.com'] },
    { name: 'Talitha Davis', emails: ['talitha.cdavis@gmail.com'] },
    { name: 'Harin Chakravarthi Maddina', emails: ['harinmaddina@gmail.com'] },
    { name: 'Esosa Osayimwen', emails: ['tee.osa2020@aol.com'] },
    { name: 'Reem fayyaz', emails: ['reemraja555@gmail.com'] },
    { name: 'William Arruda', emails: ['bill0208@gmail.com'] },
    { name: 'Rochilain Debrey Nguimathio Debrey', emails: ['demadebrey@gmail.com'] },
    { name: 'Judy George', emails: ['judygeorge41982@gmail.com'] },
    { name: 'Juan David Chavarriaga', emails: ['Jdcha751@gmail.com'] },
    { name: 'William Jones', emails: ['WilliamH.Jones@outlook.com', 'jonsey36@hotmail.com'] },
    { name: 'Anthonia Okaro', emails: ['Ebeleokaro20@gmail.com'] },
    { name: 'Alikali Ndong', emails: ['alikalindong1@gmail.com'] },
  ],
  'BATCH-25019090DS&AI': [
    { name: 'Andrew Rosenberg', emails: ['AndrewRosenberg@hotmail.com'] },
    { name: 'Ikechi Mbeyi', emails: ['ikechimbeyi@gmail.com'] },
    { name: 'venkata majeti', emails: ['sunil280@gmail.com'] },
    { name: 'Fnu Jyothi Reddy', emails: ['jyothir2808@gmail.com'] },
    { name: 'Getamesay Zegeye', emails: ['ehit06@yahoo.com', 'getgad_uss@yahoo.com'] },
    { name: 'Suman Pandey', emails: ['skpandey100@gmail.com'] },
    { name: 'anish prabhakar vedula', emails: ['prabhakar.anish@gmail.com'] },
    { name: 'Shamim Kazi', emails: ['skazi787@gmail.com'] },
    { name: "Umair Khatri'", emails: ['umair.younis001@gmail.com'] },
    { name: 'Errol Irons', emails: ['TheGadgetMaster@msn.com'] },
    { name: 'Brelan Wilcher', emails: ['wilcherb2870@gmail.com'] },
    { name: 'Ashton Taylor', emails: ['ashtontaylor5791@gmail.com'] },
    { name: 'Mohammad Matin', emails: ['mmatin93@gmail.com'] },
    { name: 'Emmanuel Ofori', emails: ['e.ofori37@hotmail.com'] },
    { name: 'Mohammad Shaikh', emails: ['mishaikh60148@gmail.com', 'mishaikh@gmail.com'] },
    { name: 'Syed Malek', emails: ['syedmalek@hotmail.com'] },
    { name: 'Alain Pierre Ombanglil', emails: ['pierrealain04@gmail.com'] },
    { name: 'Tonte Pouncil', emails: ['tonte.pouncil@gmail.com'] },
    { name: 'Lester Johnson', emails: ['milesjohnsonlester@gmail.com'] },
    { name: 'alexander lyssenko', emails: ['alyssenko@aol.com'] },
  ],
};

const DEFAULT_PASSWORD = process.argv[3] || 'Student@123';
const STUDENTS = STUDENT_LISTS[BATCH_NAME] || [];

async function main() {
  await connectMongo();

  const batch = await Batch.findOne({ name: BATCH_NAME }).exec();
  if (!batch) {
    console.error(`Batch "${BATCH_NAME}" not found`);
    process.exit(1);
  }
  const batchId = String(batch._id);
  const course = batch.course || 'Cyber Security & Ethical Hacking';
  console.log(`Adding students to ${BATCH_NAME} (${batchId})\n`);

  let created = 0;
  let updated = 0;

  for (const { name, emails } of STUDENTS) {
    for (const email of emails) {
      const normEmail = (email || '').trim().toLowerCase();
      if (!normEmail) continue;

      const existing = await User.findOne({ email: normEmail }).exec();
      if (existing) {
        if (String(existing.batchId) !== batchId) {
          existing.batchId = batchId;
          existing.course = course;
          existing.updatedAt = new Date();
          await existing.save();
          updated++;
          console.log(`  Updated: ${name} (${normEmail})`);
        } else {
          console.log(`  Skipped (already in batch): ${name} (${normEmail})`);
        }
      } else {
        const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
        await User.create({
          name,
          email: normEmail,
          password: hash,
          role: 'student',
          status: 'active',
          course,
          batchId,
        });
        created++;
        console.log(`  Created: ${name} (${normEmail}) - password: ${DEFAULT_PASSWORD}`);
      }
    }
  }

  // Rebuild Batch.students array
  const studentsInBatch = await User.find({ role: 'student', batchId }).select('_id').lean().exec();
  batch.students = studentsInBatch.map(u => u._id);
  batch.updatedAt = new Date();
  await batch.save();

  console.log(`\nDone. Created: ${created}, Updated: ${updated}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
