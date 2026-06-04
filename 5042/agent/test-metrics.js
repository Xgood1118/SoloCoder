const si = require('systeminformation');

async function test() {
  console.log('Testing metrics collection...');
  
  try {
    console.log('\n1. Testing CPU...');
    const cpu = await si.currentLoad();
    console.log('CPU load:', cpu.currentLoad);
  } catch (e) {
    console.log('CPU error:', e.message);
  }

  try {
    console.log('\n2. Testing Memory...');
    const mem = await si.mem();
    console.log('Memory total:', mem.total);
    console.log('Memory used:', mem.used);
  } catch (e) {
    console.log('Memory error:', e.message);
  }

  try {
    console.log('\n3. Testing Disk...');
    const disks = await si.fsSize();
    console.log('Disks found:', disks.length);
    disks.forEach(d => console.log(' -', d.fs, 'use:', d.use));
  } catch (e) {
    console.log('Disk error:', e.message);
  }

  try {
    console.log('\n4. Testing Network...');
    const network = await si.networkStats();
    console.log('Network interfaces:', network.length);
    network.forEach(n => console.log(' -', n.iface, 'rx_sec:', n.rx_sec));
  } catch (e) {
    console.log('Network error:', e.message);
  }

  try {
    console.log('\n5. Testing Processes...');
    const processes = await si.processes();
    console.log('Process count:', processes.all);
  } catch (e) {
    console.log('Processes error:', e.message);
  }

  console.log('\nTest complete!');
}

test().catch(console.error);
