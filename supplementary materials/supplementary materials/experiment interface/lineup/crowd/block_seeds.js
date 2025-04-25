var EXPECTED_BLOCK_SEEDS = {
            "mapDiscrete": 
            [
                /*
                {
                    "center": 0.06,
                    "p": 0.67,
                    "correlation": 0.07,
                    "expectation": 0.14077406070518209,
                    "std": 0.03499712693147202
                },
                */

                {
                    "center": 0.0635,
                    "p": 0.70,
                    "correlation": 0.07,
                    "expectation": 0.1485983954149872,
                    "std": 0.03484861875257573
                }
            ],

            "mapSmooth":
            [
                /*
                {
                    "center": 0.07325,
                    "p": 0.67,
                    "correlation": 0.07,
                    "expectation": 0.16262364695309575,
                    "std": 0.03926666068869135
                },

                {
                    "center": 0.078,
                    "p": 0.70,
                    "correlation": 0.07,
                    "expectation": 0.17003971069037296,
                    "std": 0.03831321403306914
                }
                

                {
                    "center": 0.07,
                    "p": 0.66,
                    "correlation": 0.07,
                    "expectation": 0.15857201371591031,
                    "std": 0.03677607998738302
                }
                */

                {
                    "center": 0.0635,
                    "p": 0.70,
                    "correlation": 0.07,
                    "expectation": 0.1485983954149872,
                    "std": 0.03484861875257573
                }

            ],

            "fieldSmooth":
            [
                {
                    "center": 0.07,
                    "p": 0.70,
                    "correlation": 0.07,
                    "expectation": 0.16206799327670435,
                    "std": 0.03491464751592346
                }

            ],

            "fieldDiscrete":
            [
                {
                    "center": 0.07,
                    "p": 0.70,
                    "correlation": 0.07,
                    "expectation": 0.16206799327670435,
                    "std": 0.03491464751592346
                }

            ]
};

/*
var EXPECTED_BLOCK_SEEDS = 
{
    field:  [
        {
            "center": 0.01,
            "correlation": 0.07,
            "expectation": 0.03429522608406374,
            "std": 0.009563675538098372
        },
        {
            "center": 0.02,
            "correlation": 0.07,
            "expectation": 0.057958564130388614,
            "std": 0.015484803917233872
        },
        {
            "center": 0.03,
            "correlation": 0.07,
            "expectation": 0.08515400831490025,
            "std": 0.020290996704838506
        },
        {
            "center": 0.04,
            "correlation": 0.07,
            "expectation": 0.10400974386127916,
            "std": 0.024391303936023217
        },
        {
            "center": 0.05,
            "correlation": 0.07,
            "expectation": 0.13209511707387292,
            "std": 0.03144715610869495
        },
        {
            "center": 0.06,
            "correlation": 0.07,
            "expectation": 0.14648316363609476,
            "std": 0.03322527274943045
        },
        {
            "center": 0.06999999999999999,
            "correlation": 0.07,
            "expectation": 0.15739462846691862,
            "std": 0.03280171652372637
        },
        {
            "center": 0.07999999999999999,
            "correlation": 0.07,
            "expectation": 0.17409292322721226,
            "std": 0.036853997400038335
        },
        {
            "center": 0.09,
            "correlation": 0.07,
            "expectation": 0.19786200438844684,
            "std": 0.038357628451192664
        },
        {
            "center": 0.09999999999999999,
            "correlation": 0.07,
            "expectation": 0.20504899362898585,
            "std": 0.05134618704987247
        },
        {
            "center": 0.10999999999999999,
            "correlation": 0.07,
            "expectation": 0.22047602748828615,
            "std": 0.039081607164796646
        },
        {
            "center": 0.12,
            "correlation": 0.07,
            "expectation": 0.22792675763150053,
            "std": 0.04541533982380485
        },
        {
            "center": 0.13,
            "correlation": 0.07,
            "expectation": 0.2528154156283394,
            "std": 0.04947190314584459
        },
        {
            "center": 0.14,
            "correlation": 0.07,
            "expectation": 0.26008291553747914,
            "std": 0.04615143914761944
        },
        {
            "center": 0.15,
            "correlation": 0.07,
            "expectation": 0.2659774711062707,
            "std": 0.04203655612116535
        },
        {
            "center": 0.16,
            "correlation": 0.07,
            "expectation": 0.2826691767819091,
            "std": 0.050311452747851086
        },
        {
            "center": 0.17,
            "correlation": 0.07,
            "expectation": 0.28169687944729555,
            "std": 0.04572379349540049
        },
        {
            "center": 0.18000000000000002,
            "correlation": 0.07,
            "expectation": 0.28700767674343636,
            "std": 0.047278166728670426
        },
        {
            "center": 0.19,
            "correlation": 0.07,
            "expectation": 0.3055112694305645,
            "std": 0.05217395071130096
        },
    ],

    map: [
        {
            "center": 0.01,
            "correlation": 0.07,
            "expectation": 0.03496278818662172,
            "std": 0.01068078966494109
        },
        {
            "center": 0.02,
            "correlation": 0.07,
            "expectation": 0.06315624074829436,
            "std": 0.019500719872888594
        },
        {
            "center": 0.03,
            "correlation": 0.07,
            "expectation": 0.08408915661679837,
            "std": 0.021151367369991923
        },
        {
            "center": 0.04,
            "correlation": 0.07,
            "expectation": 0.1014151358319244,
            "std": 0.02374527834486282
        },
        {
            "center": 0.05,
            "correlation": 0.07,
            "expectation": 0.12262327454047532,
            "std": 0.031552129469331024
        },
        {
            "center": 0.06,
            "correlation": 0.07,
            "expectation": 0.14124099261685003,
            "std": 0.027487320330557383
        },
        {
            "center": 0.06999999999999999,
            "correlation": 0.07,
            "expectation": 0.15813691355172874,
            "std": 0.038086738059288056
        },
        {
            "center": 0.07999999999999999,
            "correlation": 0.07,
            "expectation": 0.16921209501229628,
            "std": 0.036460072433714116
        },
        {
            "center": 0.09,
            "correlation": 0.07,
            "expectation": 0.18617804996510964,
            "std": 0.04772332516309313
        },
        {
            "center": 0.09999999999999999,
            "correlation": 0.07,
            "expectation": 0.21199702600561174,
            "std": 0.04007533989857501
        },
        {
            "center": 0.10999999999999999,
            "correlation": 0.07,
            "expectation": 0.21706559451045299,
            "std": 0.04354605374453952
        },
        {
            "center": 0.12,
            "correlation": 0.07,
            "expectation": 0.22683863895118425,
            "std": 0.05667075586356855
        },
        {
            "center": 0.13,
            "correlation": 0.07,
            "expectation": 0.24466099075252642,
            "std": 0.05026040058867802
        },
        {
            "center": 0.14,
            "correlation": 0.07,
            "expectation": 0.24436116359840018,
            "std": 0.053129260333887984
        },
        {
            "center": 0.15,
            "correlation": 0.07,
            "expectation": 0.2571005597624406,
            "std": 0.051735959681689536
        },
        {
            "center": 0.16,
            "correlation": 0.07,
            "expectation": 0.262451732142392,
            "std": 0.05072241873581107
        },
        {
            "center": 0.17,
            "correlation": 0.07,
            "expectation": 0.27664288277402543,
            "std": 0.05894530937936561
        },
        {
            "center": 0.18000000000000002,
            "correlation": 0.07,
            "expectation": 0.280480014220919,
            "std": 0.04941157245994299
        },
        {
            "center": 0.19,
            "correlation": 0.07,
            "expectation": 0.29310905802204185,
            "std": 0.05186804160283674
        },
    ],
}
*/
