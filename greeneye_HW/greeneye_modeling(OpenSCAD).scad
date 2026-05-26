// s: size [x,y,z], p: position [x,y,z]
module add(p,s) {translate(p) cube(s);}

// [추가] 빌트인(카운터싱크) 나사 홀 모듈 - 최상단으로 이동
// l_h: 뚜껑두께, d_body: 나사몸통지름, d_head: 나사머리지름, h_head: 나사머리높이
// l_h: 뚜껑두께, d_body: 나사몸통지름, d_head: 나사머리지름, h_head: 나사머리높이
module countersink_hole(x, y, l_h, d_body, d_head, h_head) {
    translate([x, y, -0.1]) { 
        // 1. 나사 몸통 구멍 (위아래로 넉넉하게 관통)
        cylinder(h=l_h + 0.5, d=d_body, $fn=50); 
        
        // 2. 나사 머리 자리 (위쪽으로 0.2mm 더 길게 만들어서 확실히 파지게 함)
        // 시작 지점을 미세하게 조정하고 높이에 여유를 줌
        translate([0, 0, l_h - h_head + 0.1]) 
            cylinder(h=h_head + 0.2, d1=d_body, d2=d_head, $fn=50);
    }
}

bw = 13; 
total_depth = bw + 34 + 20 + bw; // 80mm
top_z = 2 + 32 + 10 + 3; // 본체 높이 47mm
base_w = 2 + 112 + 2; // 116mm

// [1] 베이스 가공 (인서트 너트용 지름이다 
hole_d_base = 5.5; 
hole_h_base = 8.1; 
hole_z = top_z - 8; 

difference() {
    union() {
        add([0, 0, 0], [base_w, total_depth, 2]); // 바닥
        
        difference(){
            add([0, 0, 0], [base_w, bw, top_z]);
            //충전기쪽 오른쪽으로 밀어지는 값임
            add([50, 0, 15], [18, bw, 30 + 13]); 
        }

        difference(){
            add([0, bw+34+20, 0], [base_w, bw, top_z]);
            add([30, 0, 3], [56, total_depth, 50]);
        }

        add([0, 0, 0], [2, total_depth, top_z]); // GPS벽
        add([base_w-2, 0, 0], [2, total_depth, top_z]); // 오른쪽벽
        add([0, bw+34, 0], [30, 2, top_z]); // 모듈 옆 받침 왼쪽부분
        add([105, bw+34, 0], [10, 5, top_z]); // 모듈 옆 받침인데 오른쪽 끝
        add([0, bw+36, 0], [30, 18, 25]); 
        add([110, bw, 0], [4, 35, 21]); //오른쪽 아래 모듈 받침
    }

    // 본체 가이드 홀
    translate([10, bw/2, hole_z]) cylinder(h=hole_h_base, d=hole_d_base, $fn=50);
    translate([base_w-10, bw/2, hole_z]) cylinder(h=hole_h_base, d=hole_d_base, $fn=50);
    translate([10, total_depth - bw/2, hole_z]) cylinder(h=hole_h_base, d=hole_d_base, $fn=50);
    translate([base_w-10, total_depth - bw/2, hole_z]) cylinder(h=hole_h_base, d=hole_d_base, $fn=50);
}

// [2] 뚜껑 제작
l_h = 3; 
lid_hole_d = 4.5; // 나사 얇은 부분 지름
head_d = 8; // 나사 윗부분 지름 
head_h = 2; // 패이는 깊이

translate([0, 100, 0]) {
    union() {
        difference() {
            cube([base_w, total_depth, l_h]); 

            // --- 카운터싱크 나사 홀 호출 ---
            countersink_hole(10, bw/2, l_h, lid_hole_d, head_d, head_h);
            countersink_hole(base_w-10, bw/2, l_h, lid_hole_d, head_d, head_h);
            countersink_hole(10, total_depth - bw/2, l_h, lid_hole_d, head_d, head_h);
            countersink_hole(base_w-10, total_depth - bw/2, l_h, lid_hole_d, head_d, head_h);

            // 로고
            translate([base_w/2, total_depth/2, -0.1])
                linear_extrude(height=l_h+0.2)
                    text("GREENEYE", size=13, halign="center", valign="center", font="Arial:style=Bold");
        }
        
        translate([base_w/2 - 30.5, total_depth/2-3, 0])
            cube([1.9, 11, l_h]); 
    }
}