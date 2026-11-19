// Official CWSP roster: https://portal.cwsp.com.br/2021/01/listmember/
// Callsigns only, retrieved 2026-11-19.
const cwspMembers = new Set(`CX2PI F4WEM OA4DX PP1KV PP5KP PP5LI PP5VX PR2BP PR2CW PR2EG PR2UX PR2WW PR7AB PS7DX
PT2AW PU2KCY PU2NZR PU2PFY PU4FEL PV2YYP PY1AFG PY1EPU PY1FA PY2AA PY2ARS PY2ARY PY2ATN PY2ATR
PY2AXH PY2BIA PY2BW PY2CY PY2DEB PY2DX PY2FB PY2FRQ PY2FSF PY2HA PY2HN PY2IQ PY2IT PY2KA
PY2KP PY2LL PY2NB PY2NFE PY2NNM PY2NQC PY2NY PY2OO PY2OP PY2OT PY2OTN PY2PM PY2QI PY2RAR
PY2RD PY2RLM PY2RX PY2SP PY2SWL PY2TEY PY2UDB PY2VR PY2WMW PY2WQ PY2XL PY2YP PY2ZA PY3OO
PY3RK PY4DX PY4KS PY4LH PY4PJ PY4RL PY5WN PY7OJ W4HUB`.split(/\s+/));
export function cwspMemberConfirmed(call,exchange){
 const message=String(exchange||'').trim().toUpperCase();
 const station=String(call||'').trim().toUpperCase().replace(/\/(?:M|P|QRP)$/,'');
 return (message==='M'||message==='/M')&&cwspMembers.has(station);
}
