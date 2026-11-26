const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const env = require('../src/config/env');

const prisma = new PrismaClient();

const CULTURAL_GROUPS = [
  'BatStateU Ad Libitum Chorus',
  'BatStateU-TNEU Indak Yaman Dance Varsity',
  'BatStateU-TNEU Dulaang Batangan',
  'BatStateU-TNEU Band',
  'Diwayanis Dance Theater',
  'Sikha BatStateU-TNEU',
  'BatStateU Rondalla'
];

const REQUIREMENTS = [
  {
    key: 'waiver',
    title: "Waiver / Parent's Consent Form",
    description: 'Signed waiver or parent/guardian consent form.',
    category: 'PRE_AUDITION',
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    maxFileSizeMb: 5,
    sortOrder: 1
  },
  {
    key: 'parent_id',
    title: "Photocopy of Parent's ID with Three Specimen Signatures",
    description: 'Clear photocopy of a valid parent/guardian ID with three specimen signatures.',
    category: 'PRE_AUDITION',
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    maxFileSizeMb: 5,
    sortOrder: 2
  },
  {
    key: 'performer_profile',
    title: "Performer's Profile",
    description: "Completed performer's profile form. Unlocked only when application status is ACCEPTED.",
    category: 'POST_AUDITION',
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    maxFileSizeMb: 5,
    sortOrder: 1
  }
];

const FORMS = [
  ['audition_criteria', 'Audition Criteria for the Selection of Culture and Arts Performers Form'],
  ['pathfit_exemption', 'PathFIT Exemption Form'],
  ['pathfit_certification', 'Certification for Expanded PathFIT Course Exemption'],
  ['stipend_application', 'Application for Stipend Form'],
  ['property_borrowing', 'Culture and Arts Property Borrowing Form'],
  ['presentation_request', 'Request for Culture and Arts Presentation/Intermission Form'],
  ['trainer_evaluation', "Trainer's Evaluation Form"],
  ['audience_evaluation', 'Audience Evaluation Form']
];

async function main() {
  console.log('Seeding ArtiFile database...');

  const adminHash = await bcrypt.hash(env.seedAdminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: env.seedAdminEmail },
    update: {
      passwordHash: adminHash,
      role: 'ADMIN',
      isActive: true
    },
    create: {
      email: env.seedAdminEmail,
      passwordHash: adminHash,
      role: 'ADMIN',
      isActive: true
    }
  });
  console.log(`Admin ready: ${admin.email}`);

  for (const name of CULTURAL_GROUPS) {
    await prisma.culturalGroup.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true }
    });
  }
  console.log(`Cultural groups ready: ${CULTURAL_GROUPS.length}`);

  for (const reqItem of REQUIREMENTS) {
    await prisma.requirement.upsert({
      where: { key: reqItem.key },
      update: { ...reqItem },
      create: { ...reqItem }
    });
  }
  console.log(`Requirements ready: ${REQUIREMENTS.length}`);

  const settings = [
    ['gsuiteDomain', env.gsuiteDomain],
    ['allowedMimeTypes', 'application/pdf,image/jpeg,image/png'],
    ['allowedExtensions', 'pdf,jpg,jpeg,png'],
    ['maxFileSizeMb', '5'],
    ['systemName', 'ArtiFile'],
    ['contactEmail', 'cultureandarts.alangilan@g.batstate-u.edu.ph'],
    ['fbPage', 'https://www.facebook.com/OCABatStateUAlangilan'],
    ['telephone', '425-0139; 425-0143 loc. 2016'],
    ['officeAddress', 'Office of Culture and Arts, Batangas State University TNEU, Alangilan Campus']
  ];
  for (const [key, value] of settings) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
  }

  await prisma.resource.upsert({
    where: { key: 'oca_manual' },
    update: {
      kind: 'MANUAL',
      title: 'OCA File',
      description: 'Culture and Arts Manual of the Office of Culture and Arts.',
      sortOrder: 1
    },
    create: {
      key: 'oca_manual',
      kind: 'MANUAL',
      title: 'OCA File',
      description: 'Culture and Arts Manual of the Office of Culture and Arts.',
      sortOrder: 1
    }
  });

  await prisma.resource.upsert({
    where: { key: 'certificate_of_membership' },
    update: {
      kind: 'CERTIFICATE',
      title: 'Certificate of Membership',
      description: 'Official Certificate of Membership issued by OCA.',
      sortOrder: 1
    },
    create: {
      key: 'certificate_of_membership',
      kind: 'CERTIFICATE',
      title: 'Certificate of Membership',
      description: 'Official Certificate of Membership issued by OCA.',
      sortOrder: 1
    }
  });

  let order = 1;
  for (const [key, title] of FORMS) {
    await prisma.resource.upsert({
      where: { key },
      update: { kind: 'FORM', title, sortOrder: order },
      create: { key, kind: 'FORM', title, sortOrder: order }
    });
    order += 1;
  }
  console.log(`Resources ready: ${FORMS.length + 2}`);

  const now = new Date();
  const eventSeed = [
    {
      title: 'Pre-Audition Requirements Submission',
      description: 'Deadline for submission of waiver and parent ID requirements.',
      location: 'OCA Office, Alangilan Campus',
      startAt: new Date(now.getFullYear(), now.getMonth(), 15, 8, 0, 0)
    },
    {
      title: 'Culture and Arts Audition',
      description: 'Annual audition for student performers.',
      location: 'University Auditorium',
      startAt: new Date(now.getFullYear(), now.getMonth(), 25, 9, 0, 0)
    }
  ];
  for (const eventItem of eventSeed) {
    const existing = await prisma.event.findFirst({ where: { title: eventItem.title } });
    if (!existing) {
      await prisma.event.create({
        data: {
          title: eventItem.title,
          description: eventItem.description,
          location: eventItem.location,
          startAt: eventItem.startAt,
          createdById: admin.id
        }
      });
    }
  }

  if (process.env.SEED_SAMPLE_DATA === 'true') {
    const sampleEmail = 'sample.student@g.batstate-u.edu.ph';
    const sample = await prisma.user.upsert({
      where: { email: sampleEmail },
      update: {},
      create: {
        email: sampleEmail,
        passwordHash: await bcrypt.hash('SamplePass123!', 12),
        role: 'STUDENT'
      }
    });
    const group = await prisma.culturalGroup.findFirst({
      where: { name: 'BatStateU Ad Libitum Chorus' }
    });
    await prisma.studentProfile.upsert({
      where: { userId: sample.id },
      update: {},
      create: {
        userId: sample.id,
        fullName: 'Juan D. Dela Cruz',
        phone: '09171234567',
        yearLevel: '2nd Year',
        program: 'BS Information Technology',
        campus: 'Alangilan Campus',
        academicYear: `${now.getFullYear()}-${now.getFullYear() + 1}`,
        culturalGroupId: group.id,
        srCode: '22-00001'
      }
    });
    await prisma.application.upsert({
      where: { userId: sample.id },
      update: {},
      create: { userId: sample.id, status: 'PENDING' }
    });
    console.log(`Sample student ready: ${sampleEmail} / SamplePass123!`);
  }

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
