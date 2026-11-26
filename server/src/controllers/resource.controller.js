const prisma = require('../config/prisma');

async function getResources(req, res) {
  const resources = await prisma.resource.findMany({
    where: { isActive: true },
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }]
  });

  const grouped = {
    FORM: [],
    MANUAL: [],
    CERTIFICATE: []
  };

  for (const resource of resources) {
    if (grouped[resource.kind]) grouped[resource.kind].push(resource);
  }

  return res.status(200).json({ success: true, data: grouped });
}

async function getEvents(req, res) {
  const events = await prisma.event.findMany({
    where: { isActive: true },
    orderBy: { startAt: 'asc' }
  });

  return res.status(200).json({ success: true, data: events });
}

async function getCulturalGroups(req, res) {
  const groups = await prisma.culturalGroup.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true }
  });

  return res.status(200).json({ success: true, data: groups });
}

async function getContactDetails(req, res) {
  const settings = await prisma.setting.findMany({
    where: {
      key: { in: ['contactEmail', 'fbPage', 'telephone', 'systemName', 'officeAddress'] }
    }
  });

  const data = {};
  for (const setting of settings) data[setting.key] = setting.value;

  return res.status(200).json({ success: true, data });
}

module.exports = { getResources, getEvents, getCulturalGroups, getContactDetails };
