import { parseAndValidateBulkCSV, buildStudentsFromBulkResults } from './src/studentValidation';
import { FieldSettings, Student } from './src/types';

const fs: FieldSettings = { firstName:true,lastName:true,fatherName:true,nationalId:true,grade:true,gpa:true,school:true,phones:true };
const existing: Student[] = [{
  id:'std-1', firstName:'علی', lastName:'رضایی', fatherName:'حسن', nationalId:'0013542419',
  grade:'هفتم', gpa:18, school:'مدرسه الف', phones:[{id:'p1',label:'همراه',number:'09120000000'}], createdAt:'1404/01/01'
} as Student];

const csv = [
 'نام,نام خانوادگی,نام پدر,کد ملی,پایه,معدل,مدرسه,شماره همراه',
 'مریم,حسینی,رضا,0089994401,هشتم,19.50,"مدرسه الف، شعبه ۲",09129876543',   // valid, quoted comma in school
 'زهرا,کاظمی,علی,0089994401,هشتم,19.50,ب,09129876543',                      // dup in-file nid
 'تکراری,دیبی,خ,0013542419,دهم,19.50,ب,09129876543',                        // dup vs DB + invalid grade
 'بد,ملی,خ,12345,هشتم,25,ب,09129876543',                                    // bad nid + gpa>20
 'صفر,معدل,خ,1399143301,نهم,0,ب,09351112233',                               // valid with gpa=0
].join('\n');

const rep = parseAndValidateBulkCSV(csv, fs, existing);
console.log('total:', rep.totalDataRows, 'valid:', rep.validCount, 'invalid:', rep.invalidCount, 'fileErrors:', JSON.stringify(rep.fileErrors));
for (const r of rep.results) console.log(`line ${r.lineNo}:`, r.errors.length ? 'REJECT -> '+r.errors.join(' | ') : 'OK', '| school=', JSON.stringify(r.input.school), 'gpa=', r.input.gpa);
const built = buildStudentsFromBulkResults(rep.results, 'test');
console.log('built:', JSON.stringify(built.map(s=>({nid:s.nationalId,gpa:s.gpa,school:s.school,grade:s.grade}))));

// Header order swapped + aliases
const csv2 = ['موبایل,مدرسه,پایه تحصیلی,کد ملی,نام خانوادگی,نام'.split(',').join(','),
 '09121112233,راهنما,ششم,0016291263,محمدی,رضا'].join('\n');
const rep2 = parseAndValidateBulkCSV(csv2, fs, existing);
console.log('csv2 valid:', rep2.validCount, rep2.results[0]?.errors.join(' | ') || 'OK');

// Missing phone column => file error
const rep3 = parseAndValidateBulkCSV('نام,نام خانوادگی\nالف,ب', fs, existing);
console.log('csv3 fileErrors:', JSON.stringify(rep3.fileErrors));
