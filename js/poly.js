const polyhedral_groups = {};
const T_gen = [];
const O_gen = [];
const I_gen = [];
{
  let c = 1/2;
  let a = 1/Math.sqrt(2);
  let p = (Math.sqrt(5) + 1)/4;
  let b = (Math.sqrt(5) - 1)/4;

  T_gen.push([c,c,c,c]);
  T_gen.push([c,-c,c,c]);
  // T_gen.push([0,0,1,0]);

  O_gen.push([c,c,c,c]);
  O_gen.push([0,0,a,a]);
  // O_gen.push([0,a,a,0]);

  I_gen.push([c,c,c,c]);
  I_gen.push([c,0,b,p]);
  // I_gen.push([c,b,p,0]);

  // D_gen.push(quaternion([0,0,1], 4*Q/n));
  // D_gen.push([1,0,0,0]);

  polyhedral_groups.T = [
    [ 0, 0, 0, 1],
    [ 1, 0, 0, 0],
    [ 0, 1, 0, 0],
    [ 0, 0, 1, 0],
    [ c, c, c, c],
    [-c, c, c, c],
    [ c,-c, c, c],
    [ c, c,-c, c],
    [ c,-c,-c, c],
    [-c, c,-c, c],
    [-c,-c, c, c],
    [-c,-c,-c, c]
  ];
  polyhedral_groups.O = [
    [ 0, 0, 0, 1],
    [ 1, 0, 0, 0],
    [ 0, 1, 0, 0],
    [ 0, 0, 1, 0],
    [ c, c, c, c],
    [-c, c, c, c],
    [ c,-c, c, c],
    [ c, c,-c, c],
    [ c,-c,-c, c],
    [-c, c,-c, c],
    [-c,-c, c, c],
    [-c,-c,-c, c],
    [ a, 0, 0, a],
    [-a, 0, 0, a],
    [ 0, a, 0, a],
    [ 0,-a, 0, a],
    [ 0, 0, a, a],
    [ 0, 0,-a, a],
    [ 0, a, a, 0],
    [ a, 0, a, 0],
    [ a, a, 0, 0],
    [ 0,-a, a, 0],
    [ a, 0,-a, 0],
    [-a, a, 0, 0]
  ];
  polyhedral_groups.I = [
    [ 0, 0, 0, 1],
    [ 1, 0, 0, 0],
    [ 0, 1, 0, 0],
    [ 0, 0, 1, 0],
    [ c, c, c, c],
    [-c, c, c, c],
    [ c,-c, c, c],
    [ c, c,-c, c],
    [ c,-c,-c, c],
    [-c, c,-c, c],
    [-c,-c, c, c],
    [-c,-c,-c, c],
    [ c, b, p, 0],
    [ c,-b,-p, 0],
    [-c, b,-p, 0],
    [-c,-b, p, 0],
    [ b, p, c, 0],
    [ b,-p,-c, 0],
    [-b, p,-c, 0],
    [-b,-p, c, 0],
    [ p, c, b, 0],
    [ p,-c,-b, 0],
    [-p, c,-b, 0],
    [-p,-c, b, 0],
    [ 0, b, c, p],
    [ 0,-b, c,-p],
    [ 0, b,-c,-p],
    [ 0,-b,-c, p],
    [ 0, c, p, b],
    [ 0, c,-p,-b],
    [ 0,-c,-p, b],
    [ 0,-c, p,-b],
    [ 0, p, b, c],
    [ 0,-p,-b, c],
    [ 0,-p, b,-c],
    [ 0, p,-b,-c],
    [ c, 0, b, p],
    [ c, 0,-b,-p],
    [-c, 0, b,-p],
    [-c, 0,-b, p],
    [ b, 0, p, c],
    [-b, 0,-p, c],
    [ b, 0,-p,-c],
    [-b, 0, p,-c],
    [ p, 0, c, b],
    [-p, 0, c,-b],
    [-p, 0,-c, b],
    [ p, 0,-c,-b],
    [ b, c, 0, p],
    [-b, c, 0,-p],
    [ b,-c, 0,-p],
    [-b,-c, 0, p],
    [ c, p, 0, b],
    [ c,-p, 0,-b],
    [-c,-p, 0, b],
    [-c, p, 0,-b],
    [ p, b, 0, c],
    [-p,-b, 0, c],
    [-p, b, 0,-c],
    [ p,-b, 0,-c]
  ];

  Object.freeze(polyhedral_groups);
}
