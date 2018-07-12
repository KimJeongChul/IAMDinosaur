var synaptic = require('synaptic');
var async = require('async');
var _ = require('lodash');

var Architect = synaptic.Architect;
var Network = synaptic.Network;


var Learn = {

  // 현재 유전자(Genomes)를 위한 네트워크의 배열
  // 유전자는 fitness(적합도)라는 키로 추가가 되어집니다.
  genomes: [],

  // 현재 학습 [STOP, LEARNING] 상태 변수
  state: 'STOP',

  // 현재 유전자/세대수 변수
  genome: 0,
  generation: 0,

  // 이것을 true로 설정하면, 실행이 되기전에 유전자(genome) 실험을 확인해봅니다.
  shouldCheckExperience: false,

};


// 학습기를 초기화합니다.
Learn.init = function (gameManip, ui, genomeUnits, selection, mutationProb) {
  Learn.gm = gameManip;
  Learn.ui = ui;

  Learn.genome = 0;
  Learn.generation = 0;

  Learn.genomeUnits = genomeUnits;
  Learn.selection = selection;
  Learn.mutationProb = mutationProb;
}


// executeGeneration을 호출하기 이전에 유전자(genomes)를 빌드(build)합니다.
Learn.startLearning = function () {

  // 유전자 빌드가 필요하다면
  while (Learn.genomes.length < Learn.genomeUnits) {
    Learn.genomes.push(Learn.buildGenome(3, 1));
  }

  Learn.executeGeneration();
  
}


// 유전자 세대 전체(배열)를 감안할 때,
// 각 요소에 `executeGenome` 메소드를 적용합니다.
// 모든 요소가 완료되면 :
//
// 1) 최고의 유전자(genomes) 선택
// 2) 크로스 오버(cross-over) (2개의 유전자(genomes) 제외)
// 3) 남아있는 유전자에서만 돌연변이(mutation)를합니다.
// 4) 생성 실행 (반복적으로)
Learn.executeGeneration = function (){
  if (Learn.state == 'STOP') {
    return;
  }

  Learn.generation++;
  Learn.ui.logger.log('Executing generation '+Learn.generation);

  Learn.genome = 0;

  async.mapSeries(Learn.genomes, Learn.executeGenome, function (argument) {

    // 안좋은 유전자는 죽입니다.
    Learn.genomes = Learn.selectBestGenomes(Learn.selection);

    // 제일 좋은 유전자는 복사합니다.
    var bestGenomes = _.clone(Learn.genomes);

    // 교차 - 크로스 오버(Cross Over)
    while (Learn.genomes.length < Learn.genomeUnits - 2) {
      // 두 개의 랜덤 유전자를 가져옵니다.
      var genA = _.sample(bestGenomes).toJSON();
      var genB = _.sample(bestGenomes).toJSON();

      // 교차(cross over)와 돌연변이(mutate)
      var newGenome = Learn.mutate(Learn.crossOver(genA, genB));

      // 세대 수를 추가합니다.
      Learn.genomes.push(Network.fromJSON(newGenome));
    }

    // 돌연 변이(mutation)만 진행
    while (Learn.genomes.length < Learn.genomeUnits) {
      // 두 개의 랜덤 유전자를 가져옵니다.
      var gen = _.sample(bestGenomes).toJSON();

      // 돌연변이
      var newGenome = Learn.mutate(gen);

      // 세대 수를 추가합니다.
      Learn.genomes.push(Network.fromJSON(newGenome));
    }

    Learn.ui.logger.log('Completed generation '+Learn.generation);

    // 다음 세대를 실행합니다.
    Learn.executeGeneration();
  })
}


// 모든 유전자(genomes)을 정렬하고, 제일 안좋은 유전자를 제거합니다.
// 유전자 리스트가 N개의 요소를 가질 때까지
Learn.selectBestGenomes = function (selectN){
  var selected = _.sortBy(Learn.genomes, 'fitness').reverse();

  while (selected.length > selectN) {
    selected.pop();
  }

  Learn.ui.logger.log('Fitness: '+_.pluck(selected, 'fitness').join(','));

  return selected;
}


// 게임이 끝날 때까지 기다린 후 새 게임을 시작한 다음 :
// 1) sensorData에 대한 리스너(listener) 설정
// 2) 데이터 읽기에서 신경망(neural network)을 적용하고 출력을 설정합니다.
// 3) 게임이 끝나고 적합도(fitness)가 계산할 때까지
Learn.executeGenome = function (genome, next){
  if (Learn.state == 'STOP') {
    return;
  }

  Learn.genome = Learn.genomes.indexOf(genome) + 1;
  // Learn.ui.logger.log('Executing genome '+Learn.genome);

  // 유전자 적어도 경험을 가지고 있는 지 확인합니다.
  if (Learn.shouldCheckExperience) {
    if (!Learn.checkExperience(genome)) {
      genome.fitness = 0;
      // Learn.ui.logger.log('Genome '+Learn.genome+' has no min. experience');
      return next();
    }
  }

  Learn.gm.startNewGame(function (){

    // 센서 데이터를 읽고, 네트워크를 적용합니다.
    Learn.gm.onSensorData = function (){
      var inputs = [
        Learn.gm.sensors[0].value,
        Learn.gm.sensors[0].size,
        Learn.gm.sensors[0].speed,
      ];
      // console.log(inputs);
      // 네트워크를 적용합니다.
      var outputs = genome.activate(inputs);

      Learn.gm.setGameOutput(outputs[0]);
    }

    // 게임 끝나는 것을 기다리고, 적합도(fitness)를 계산합니다.
    Learn.gm.onGameEnd = function (points){
      Learn.ui.logger.log('Genome '+Learn.genome+' ended. Fitness: '+points);

      // 유전자(genome) 적합도(fitness)를 저장합니다.
      genome.fitness = points;

      // 다음 유전자(genome)으로 이동합니다.
      next();
    }
  });

}


// 주어진 입력에 액션이 발생하면 유효성을 검사합니다 (이 경우 distance).
// 유전자가 특정 입력에 대해 단일 활성 값만 유지하는 경우,
// false를 반환합니다.
Learn.checkExperience = function (genome) {
  
  var step = 0.1, start = 0.0, stop = 1;

  // 입력값은 기본값입니다. 처음 인덱스만 테스트합니다.
  var inputs = [0.0, 0.3, 0.2];
  var activation, state, outputs = {};

  for (var k = start; k < stop; k += step) {
    inputs[0] = k;

    activation = genome.activate(inputs);
    state = Learn.gm.getDiscreteState(activation);
    
    outputs[state] = true;
  }

  // 상태(state)를 카운트하고, 1보다 크면 true를 리턴합니다.
  return _.keys(outputs).length > 1;
}


// 저장된 JSON 파일로부터 유전자(genomes)를 로드합니다.
Learn.loadGenomes = function (genomes, deleteOthers){
  if (deleteOthers) {
    Learn.genomes = [];
  }

  var loaded = 0;
  for (var k in genomes) {
    Learn.genomes.push(Network.fromJSON(genomes[k]));
    loaded++;
  }

  Learn.ui.logger.log('Loaded '+loaded+' genomes!');
}


// 기대되는 입력과 출력의 수를 기반으로 새로운 유전자(genome)를 빌드합니다.
Learn.buildGenome = function (inputs, outputs) {
  Learn.ui.logger.log('Build genome '+(Learn.genomes.length+1));

  var network = new Architect.Perceptron(inputs, 4, 4, outputs);

  return network;
}


// 신경망(Neural Network)에 명세
// 이 두 메소드는 JSON을 Array로 변환하고 Array에서 JSON으로 변환합니다.
Learn.crossOver = function (netA, netB) {
  // Swap (50% prob.)
  if (Math.random() > 0.5) {
    var tmp = netA;
    netA = netB;
    netB = tmp;
  }

  // 네트워크를 복제합니다.(clone)
  netA = _.cloneDeep(netA);
  netB = _.cloneDeep(netB);

  // 데이터 키(key)로 교차(cross over)
  Learn.crossOverDataKey(netA.neurons, netB.neurons, 'bias');

  return netA;
}


// 랜덤 돌연변이(mutation)을 네트워크의 bias 및 weight
// (JSON에서이 작업을 수행해야 합니다.
// 현재의 네트워크를 수정하는 것을 막습니다)
Learn.mutate = function (net){
  //돌연변이
  Learn.mutateDataKeys(net.neurons, 'bias', Learn.mutationProb);
  
  Learn.mutateDataKeys(net.connections, 'weight', Learn.mutationProb);

  return net;
}


// 주어진 객체 A와 객체 B, 두 배열 오브젝트 :
//
// 1) 교차점 선택 (cutLocation)
// 무작위로 (0에서 A.length로 이동)
// 2) 'key'값을 다른 것으로 바꾼다.
// cutLocation으로 시작
Learn.crossOverDataKey = function (a, b, key) {
  var cutLocation = Math.round(a.length * Math.random());

  var tmp;
  for (var k = cutLocation; k < a.length; k++) {
    // Swap
    tmp = a[k][key];
    a[k][key] = b[k][key];
    b[k][key] = tmp;
  }
}



// 키`key` 또한 mutationRate를 가지는 객체의 배열이 주어진다면,
// 무작위로 돌연변이(mutate)합니다.
// 임의의 값이있는 경우 각 키의 값
// 각 요소에 대해 mutationRate보다 낮습니다.
Learn.mutateDataKeys = function (a, key, mutationRate){
  for (var k = 0; k < a.length; k++) {
    // Should mutate?
    if (Math.random() > mutationRate) {
      continue;
    }

    a[k][key] += a[k][key] * (Math.random() - 0.5) * 3 + (Math.random() - 0.5);
  }
}


module.exports = Learn;