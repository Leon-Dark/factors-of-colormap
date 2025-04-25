// based on https://github.com/connorgr/colorgorical
function ciede2000(Lstd, astd, bstd, Lsample,
                 asample, bsample) 
{
  var M_PI = Math.PI;
  var kl = 1.0;
  var kc = 1.0;
  var kh = 1.0;
  var Cabstd = Math.sqrt(astd*astd + bstd*bstd);
  var Cabsample = Math.sqrt(asample*asample + bsample*bsample);
  var Cabarithmean = (Cabstd + Cabsample)/2.0;
  var G = 0.5 * (1.0 - Math.sqrt(Math.pow(Cabarithmean, 7.0) /
             (Math.pow(Cabarithmean, 7.0) + Math.pow(25.0, 7.0))));
  // calculate a'
  var apstd = (1.0+G)*astd;
  var apsample = (1.0+G)*asample;
  var Cpsample = Math.sqrt(apsample*apsample + bsample*bsample);
  var Cpstd = Math.sqrt(apstd*apstd + bstd*bstd);
  // Compute the product of chromas and locations at which it is 0
  var Cpprod = Cpsample*Cpstd;
  // Make sure that hue is between 0 and 2pi
  var hpstd = Math.atan2(bstd, apstd);
  if(hpstd < 0.0) hpstd += 2.0 * M_PI;
  var hpsample = Math.atan2(bsample, apsample);
  if(hpsample < 0.0) hpsample += 2.0 * M_PI;
  var dL = Lsample - Lstd;
  var dC = Cpsample - Cpstd;
  // Compute hue distance
  var dhp = hpsample - hpstd;
  if(dhp > M_PI) dhp -= 2.0*M_PI;
  if(dhp < -1.0*M_PI) dhp += 2.0*M_PI;
  // Set chroma difference to zero if product of chromas is zero
  if(Cpprod == 0.0) dhp = 0.0;
  // CIEDE2000 requires signed hue and chroma differences, differing from older
  //  color difference formulae
  var dH = 2.0*Math.sqrt(Cpprod)*Math.sin(dhp/2.0);
  // Weighting functions
  var Lp = (Lsample+Lstd)/2.0;
  var Cp = (Cpstd+Cpsample)/2.0;
  // Compute average hue
  // avg hue is computed in radians and converted to degrees only where needed
  var hp = (hpstd+hpsample)/2.0;
  // Identify positions for which abs hue diff > 180 degrees
  if(Math.abs(hpstd-hpsample) > M_PI) hp -= M_PI;
  // rollover those that are under
  if(hp < 0.0) hp += 2.0 * M_PI;
  // if one of the chroma values = 0, set mean hue to the sum of two chromas
  if(Cpprod == 0.0) hp = hpstd + hpsample;
  var Lpm502 = (Lp-50.0)*(Lp-50.0);
  var Sl = 1.0 + 0.015*Lpm502 / Math.sqrt(20.0+Lpm502);
  var Sc = 1.0 + 0.045*Cp;
  var T = 1.0 - 0.17*Math.cos(hp - M_PI/6.0)
               + 0.24*Math.cos(2.0*hp)
               + 0.32*Math.cos(3.0*hp + M_PI/30.0)
               - 0.20*Math.cos(4.0*hp - 63.0*M_PI/180.0);
  var Sh = 1.0 + 0.015*Cp*T;
  var delthetarad = (30.0*M_PI/180.0) *
                       Math.exp(-1.0* ( Math.pow((180.0/M_PI*hp - 275.0)/25.0, 2.0) ));
  var Rc = 2.0*Math.sqrt(Math.pow(Cp, 7.0)/(Math.pow(Cp, 7.0) + Math.pow(25.0, 7.0)));
  var RT = -1.0 * Math.sin(2.0*delthetarad)*Rc;
  var klSl = kl*Sl;
  var kcSc = kc*Sc;
  var khSh = kh*Sh;
  var de = Math.sqrt( Math.pow(dL/klSl, 2.0) + Math.pow(dC/kcSc, 2.0) + Math.pow(dH/khSh, 2.0) +
                    RT*(dC/kcSc)*(dH/khSh) );
  return de;
}