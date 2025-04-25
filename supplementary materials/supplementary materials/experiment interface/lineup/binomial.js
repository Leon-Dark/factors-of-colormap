function bitprint(u) {
	var s="";
	for (var n=0; u; ++n, u>>=1)
		if (u&1) s+=n+" ";
			return s;
}
function bitcount(u) {
	for (var n=0; u; ++n, u=u&(u-1));
	return n;
}

function comb(c,n) 
{
	var s=[];
	for (var u=0; u<1<<n; u++)
		if (bitcount(u)==c)
			s.push(bitprint(u))
	return s.sort();
}

function nChooseK(n, k)
{
	var out = comb(k, n);
	var sets = [];
	for (var i=0, len=out.length; i<len; i++)
	{
		var code = '';
		var tokens = out[i].split(' ');
		for (var j=0; j<tokens.length; j++) {
			if (tokens[j].length > 0) {
				res = String.fromCharCode('a'.charCodeAt(0) + +tokens[j]);
				code += res;
			}
		}
		sets.push(code)
	}
	return sets;
}
