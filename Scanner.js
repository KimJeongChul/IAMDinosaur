var robot = require('robotjs');

// screen의 사이즈 너비(width)와 높이(height)
var screenSize = robot.getScreenSize();

// Indexes
var X = 0;
var Y = 1;


// Create the "class" wrapper
var Scanner = {};

// 지금 현재 위치가 screen의 밖에 있는지 확인합니다. 밖에 있다면 검사할 필요가 없습니다.
// screen의 너비(width)와 높이(height) 보다 크다면 밖에 있는 점이므로 true르 리턴합니다.
Scanner.isOutOfBound = function (pos) {
  if ( pos[X] < 0 || pos[Y] < 0 ||
     pos[X] >= screenSize.width ||
     pos[Y] >= screenSize.height) {

    return true;
  }

  return false;
}

// x, y의 좌표 위치를 스크린(screen)를 벗어나지 않도록
// screen의 너비(width)와 높이(height) 보다 큰 경우 경계의 -1로
// 0보다 작다면 위치를 0으로 이동합니다.
// 위치를 제한합니다.
Scanner.makeInBounds = function (pos) {

  if (pos[X] < 0) {
    pos[X] = 0;
  }

  if (pos[X] >= screenSize.width) {
    pos[X] = screenSize.width - 1;
  }

  if (pos[Y] < 0) {
    pos[Y] = 0;
  }

  if (pos[Y] >= screenSize.height) {
    pos[Y] = screenSize.height - 1;
  }

  return pos;
}


// 시작 [X, Y]와 DELTA [dx, dy]가 주어진다면,
// 맵 "start"로부터 delta(변동량)만큼 포지션을 더하여,
// matchinColor를 찾을 때까지, 또는 isOutOfBounds를 통해 맵의 밖으로 나갈 때까지 진행합니다.
//
//  If iterations reach > iterLimit:
//    returns null;
//
//  if isOutOfBounds:
//    returns null
//
//  otherwise:
//    return that point
//
//  Example: (X direction)
//    scanUntil([0,0], [1, 0], "000000");
Scanner.scanUntil = function (start, delta, matchColor, inverted, iterLimit) {
  var color, current, iterations = 0;

  //  makeInBounds를 호출해 screen 안에 있는 좌표로 clone 합니다.
  current = Scanner.makeInBounds([start[X], start[Y]]);

  if (delta[X] == 0 && delta[Y] == 0) {
    return null;
  }


  while (!Scanner.isOutOfBound(current)) {
    // 현재 위치 픽셀(pixel)의 색을 가져옵니다.
    color = robot.getPixelColor(current[X], current[Y]);

    // Color가 일치할 경우
    if (!inverted && color.toString() == matchColor) {
      return current;
    }
    
    // 뒤집힌 모드일 경우 Color의 색이 같지 않아야 한다.
    if (inverted && color.toString() != matchColor) {
      return current;
    }

    current[X] += delta[X];
    current[Y] += delta[Y];
    iterations++;

    if (iterations > iterLimit) {
      return null;
    }
  }

  return null;
};


// Export the module
module.exports = Scanner;
