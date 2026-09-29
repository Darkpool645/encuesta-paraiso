// Definición de la Encuesta de Clima Laboral – Paraíso Country Club
// Editar este archivo para modificar preguntas, rubros u opciones.

const DEPARTAMENTOS = [
  'Administración',
  'Alimentos y Bebidas (Cocina)',
  'Alimentos y Bebidas (Servicio)',
  'Campo de golf',
  'Jardinería',
  'Mantenimiento',
  'Limpieza',
];

const ANTIGUEDAD = [
  'Menos de 6 meses',
  'De 6 meses a 1 año',
  'De 1 a 3 años',
  'Más de 3 años',
  'Prefiero no responder',
];

const ESCALA = [
  { valor: 1, etiqueta: 'Totalmente en desacuerdo' },
  { valor: 2, etiqueta: 'En desacuerdo' },
  { valor: 3, etiqueta: 'Ni de acuerdo ni en desacuerdo' },
  { valor: 4, etiqueta: 'De acuerdo' },
  { valor: 5, etiqueta: 'Totalmente de acuerdo' },
  { valor: 0, etiqueta: 'No aplica / No sé' },
];

const RUBROS = [
  {
    id: 'R1', nombre: 'Ambiente laboral y compañerismo',
    preguntas: [
      { id: 'p3', num: 3, texto: 'En mi área existe un buen ambiente de trabajo.' },
      { id: 'p4', num: 4, texto: 'Mis compañeros y yo nos ayudamos cuando es necesario.' },
      { id: 'p5', num: 5, texto: 'En mi equipo nos tratamos con respeto.' },
    ],
  },
  {
    id: 'R2', nombre: 'Liderazgo y trato del jefe inmediato',
    preguntas: [
      { id: 'p6', num: 6, texto: 'Mi jefe inmediato me trata con respeto.' },
      { id: 'p7', num: 7, texto: 'Mi jefe escucha mis opiniones y necesidades.' },
      { id: 'p8', num: 8, texto: 'Mi jefe me da indicaciones claras para realizar mi trabajo.' },
    ],
  },
  {
    id: 'R3', nombre: 'Comunicación interna',
    preguntas: [
      { id: 'p9', num: 9, texto: 'Recibo a tiempo la información que necesito para hacer mi trabajo.' },
      { id: 'p10', num: 10, texto: 'Cuando hay cambios que afectan mi trabajo, me los comunican claramente.' },
      { id: 'p11', num: 11, texto: 'Sé a quién acudir cuando tengo una duda o un problema laboral.' },
    ],
  },
  {
    id: 'R4', nombre: 'Condiciones y herramientas de trabajo',
    preguntas: [
      { id: 'p12', num: 12, texto: 'Cuento con las herramientas y materiales necesarios para hacer mi trabajo.' },
      { id: 'p13', num: 13, texto: 'Mi lugar de trabajo cuenta con condiciones adecuadas de limpieza y seguridad.' },
      { id: 'p14', num: 14, texto: 'La cantidad de trabajo que tengo es razonable para mi jornada.' },
    ],
  },
  {
    id: 'R5', nombre: 'Reconocimiento y valoración',
    preguntas: [
      { id: 'p15', num: 15, texto: 'Mi trabajo es importante para Paraíso Country Club.' },
      { id: 'p16', num: 16, texto: 'Cuando hago bien mi trabajo, mi esfuerzo es reconocido.' },
      { id: 'p17', num: 17, texto: 'Siento que mi trabajo es valorado por mis superiores.' },
    ],
  },
  {
    id: 'R6', nombre: 'Sueldo y prestaciones',
    preguntas: [
      { id: 'p18', num: 18, texto: 'Estoy satisfecho con el sueldo que recibo por mi trabajo.' },
      { id: 'p19', num: 19, texto: 'Conozco las prestaciones y beneficios que me ofrece Paraíso Country Club.' },
      { id: 'p20', num: 20, texto: 'Estoy satisfecho con las prestaciones y beneficios que recibo.' },
    ],
  },
  {
    id: 'R7', nombre: 'Capacitación y desarrollo',
    preguntas: [
      { id: 'p21', num: 21, texto: 'Recibo la capacitación necesaria para realizar bien mi trabajo.' },
      { id: 'p22', num: 22, texto: 'Tengo oportunidades para aprender cosas nuevas en mi puesto.' },
      { id: 'p23', num: 23, texto: 'Conozco las oportunidades que existen para crecer dentro de la empresa.' },
      { id: 'p24', num: 24, texto: 'Recibo orientación para mejorar cuando cometo algún error.' },
    ],
  },
  {
    id: 'R8', nombre: 'Bienestar, satisfacción y pertenencia',
    preguntas: [
      { id: 'p25', num: 25, texto: 'Me siento satisfecho trabajando en Paraíso Country Club.' },
      { id: 'p26', num: 26, texto: 'Mi horario de trabajo me permite atender mis necesidades personales y familiares.' },
      { id: 'p27', num: 27, texto: 'Me siento orgulloso de formar parte de Paraíso Country Club.' },
      { id: 'p28', num: 28, texto: 'Recomendaría Paraíso Country Club como un buen lugar para trabajar.' },
    ],
  },
];

const ABIERTAS = [
  { id: 'p29', num: 29, texto: '¿Qué es lo que más te gusta de trabajar en Paraíso Country Club?' },
  { id: 'p30', num: 30, texto: 'Si pudieras cambiar o mejorar algo en Paraíso Country Club, ¿qué sería?' },
  { id: 'p31', num: 31, texto: 'Sugerencias para hacer de Paraíso un mejor lugar para trabajar.' },
];

const PREGUNTAS_ESCALA = RUBROS.flatMap(r => r.preguntas.map(p => ({ ...p, rubro: r.id })));

module.exports = { DEPARTAMENTOS, ANTIGUEDAD, ESCALA, RUBROS, ABIERTAS, PREGUNTAS_ESCALA };
