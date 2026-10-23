"""Plan de contenido de los diez barrios: historia (≈5 h), secundarias (≈5 h),
seis actividades distintas, sucesos, rincones y el prompt para la IA de guiones.

Cada barrio tiene un género distinto. Los lugares (`places`) llevan
coordenadas del plano (x este, y sur, en metros); las misiones se refieren a
ellos por su clave. Claves especiales: 'tower' (torre de la PDC), 'anchor'
(Ancla), 'inc' (Encarnación) y 'entry' (frontera de entrada).
"""

# Hilos que cruzan los diez barrios
THREADS = [
    ('Iker y la Defensa', 'Las barreras son una marca viva. Iker, el amigo de Jon, está encadenado al Amplificador en lo alto de la Torre.',
     {'cero': 'Salaberri menciona «el chico de la Torre».', 'bloques': 'Revelación: el Ancla es Iker.', 'colinas': 'Cómo funciona el Amplificador (la voz de Lucía).',
      'puerto': 'Llega un Segundo Amplificador.', 'chino': 'La paloma vuelve de la Torre con una pluma ámbar.', 'centro': 'Jon convence a Iker y copia la Defensa.'}),
    ('La Centralita', 'La voz anónima de la resistencia que habla por las cabinas. Es la Dra. Edurne Lasa, la ingeniera que diseñó el Amplificador.',
     {'cero': 'Primera llamada en la plaza del Kilómetro Cero.', 'midtown': 'El noticiario del Proyecto Ascend la muestra de espaldas.',
      'puerto': 'El contenedor 0451 revela quién es.', 'centro': 'Jon la conoce en persona y decide si la perdona.'}),
    ('El maestro de los Acólitos', 'Alguien presta poder a los Acólitos a cambio de sangre. Es Narbaiza: el terror de los marcados justifica a la PDC.',
     {'cero': 'El Diácono usa un poder que no es suyo.', 'industrial': 'Altar con sangre seca en el horno apagado.', 'parque': 'La Jardinera le llama «el Donante».',
      'colinas': 'El diario de Narbaiza habla de prestar la Marca de Sangre.', 'chino': 'Viales con el sello de la PDC: el maestro es Narbaiza.', 'centro': 'Jefe final.'}),
    ('Decisiones que vuelven', 'Elecciones de un barrio con consecuencias más adelante.',
     {'cero': 'Pello: entregarlo o dejarlo huir (Los Bloques).', 'industrial': 'La Directora entrega o no los planos de los escudos (El Centro).',
      'parque': 'Copiar a Lur sin permiso o ganar su confianza (final).', 'colinas': 'Elorza huye o cae (El Centro).',
      'puerto': 'Hundir el Segundo Amplificador o quedárselo (El Centro).', 'costa': 'Convencer o derrotar a la Patrona (El Centro).',
      'centro': 'Perdonar o no a la Centralita.'}),
]

# Lo que el jugador ya sabe al empezar los barrios (resumen del prólogo M01–M05)
PROLOGUE = (
    'Jon es un chico de un pueblo costero. Una noche entra con su amigo Iker en una base del Proyecto Ascend y recibe el Destino, '
    'una marca que le permite copiar la marca de las Encarnaciones (personas que nacen con una marca de poder). Al día siguiente, el '
    'general Narbaiza, de la PDC (la policía que caza a los marcados), humilla al pueblo en la plaza; Jon discute con Iker. Cinco días '
    'después, una tormenta mata a la abuela de Jon. Jon copia la Energía de una Encarnación y decide si la mata o la perdona. La PDC '
    'le captura; el autobús de presos cae de un viaducto; Jon huye por el bosque, aprende a usar la Energía contra drones, cruza un '
    'puente destruido y ve por primera vez la ciudad de Ibaia, encerrada en barreras de luz ámbar. Iker desapareció la noche de la base.'
)

CITY_RULES = (
    'Ibaia tiene diez barrios. Cada uno está encerrado por una barrera de la Defensa (muros de luz ámbar de 300 m) que se sostiene en un '
    'Ancla dentro del barrio. En cada barrio vive una Encarnación: Jon la encuentra y copia su marca (regla III del Destino: solo con '
    'permiso, salvo con Lur, donde puede elegir). Con esa marca llega al Ancla, la rompe y cae la barrera hacia el barrio siguiente. '
    'Cada barrio tiene una Torre de la PDC (al tomarla se descubren actividades), un porcentaje de control de la PDC que baja con las '
    'secundarias y actividades, y dos estaciones de metro para el viaje rápido.'
)

P = {}

# ---------------------------------------------------------------------------
P['cero'] = dict(
    title='Línea Cero', genre='Thriller noir de espionaje',
    tone='Lluvia, cabinas telefónicas, bares de ladrillo y desconfianza. Jon está solo y nadie se fía de un marcado recién llegado.',
    premise='Jon baja de la sierra empapado y buscado por el ataque al convoy. En la plaza del Kilómetro Cero suena una cabina a su paso: es la Centralita, la voz que dirige la resistencia por la red de teléfonos públicos. La red se está cayendo: en dos semanas la PDC ha asaltado cuatro pisos francos. Alguien vende las direcciones. La Centralita le ofrece un trato: si encuentra al chivato, la resistencia le ayuda a romper la barrera.',
    villain=('Comisario Salaberri', 'Jefe de la PDC en el distrito. Metódico y educado; nunca levanta la voz. Graba todas las llamadas del barrio y colecciona voces. Le acompaña un dron sabueso que sigue la carga eléctrica de los marcados.'),
    allies=[('La Centralita', 'Voz distorsionada al otro lado del teléfono. Seca, precisa, no da explicaciones.'),
            ('Txema', 'Dueño del bar La Catenaria, antiguo sindicalista. Gruñón, protector. Encima del bar está el piso franco.'),
            ('Rosa Arregi', 'Conductora jubilada del tranvía. Conoce cada metro de la línea 0 y de la subestación.'),
            ('Pello', '16 años, recadero de la resistencia. El más rápido por los tejados. Habla mucho y bromea siempre.')],
    twist='El chivato es Pello. La PDC tiene a su hermana Ane en el Estadio del Norte y le ha prometido soltarla. Jon decide si lo entrega a la resistencia o le deja huir hacia Los Bloques; la decisión cambia una secundaria de Los Bloques.',
    ending='Rosa arranca el tranvía histórico de la línea 0 y Jon lo usa como batería rodante para sobrecargar el Ancla de la Subestación mientras la PDC asalta. Cae la barrera de la Avenida de la Fundición. En la cabina de la plaza, un mensaje de Salaberri: tiene la voz de Jon grabada.',
    result='Jon limpió la red de la resistencia, descubrió al chivato (Pello) y rompió el Ancla de la Subestación con el tranvía de la línea 0.',
    places=[
        ('autovia', 'Autovía de la Sierra', (7700, 520), 'Por donde entra Jon: control de la PDC, coches abandonados bajo la lluvia y la primera vista del barrio.'),
        ('km0', 'Plaza del Kilómetro Cero', (6850, 960), 'La fuente, la cabina que suena y la placa con trampilla al cuarto de máquinas del tranvía.'),
        ('neones', 'Calle de los Neones', (7000, 860), 'Bares y clubes con escaleras de incendios: la calle más vertical del barrio, con letreros que se encienden con Energía.'),
        ('bar', 'Bar La Catenaria', (6960, 1450), 'Ladrillo bajo las vías. Billar, máquina de discos, sótano con salida a la alcantarilla y el piso franco arriba.'),
        ('estacion', 'Estación del Este', (6700, 1330), 'Estación del tren elevado en hierro y cristal: andén alto, pasarelas y trenes en marcha a los que subirse.'),
        ('puente', 'Puente de Hierro', (6330, 1150), 'Celosías de acero para escalar. La barrera corta el puente a la mitad y deja ver la Isla.'),
        ('sub', 'Subestación del Tranvía', (7300, 1300), 'Transformadores, cocheras con tranvías viejos y la catenaria que zumba: carga sin fin y zona del Ancla.'),
        ('iglesia', 'Iglesia de San Roque', (7150, 620), 'Claustro, cripta y campanario cerrado. De noche rezan aquí los Acólitos.'),
        ('mercado', 'Mercado de la Ribera', (6150, 650), 'Nave de hierro sobre el río: puestos cerrados, cámaras frigoríficas y el metro inundado debajo.'),
        ('cine', 'Cine Ascenso', (6600, 760), 'Letrero de siete letras apagado. La cabina de proyección guarda un noticiario del Proyecto Ascend.'),
    ],
    story=[
        ('El teléfono de la plaza', 'km0', 25, 'Jon esquiva el control de la autovía y llega a la plaza. Suena la cabina: la Centralita. Primer paseo por la ciudad: parkour por fachadas, recarga en farolas y huida del dron sabueso.'),
        ('La Catenaria', 'bar', 25, 'Txema no se fía. Una redada entra en el bar justo cuando Jon llega: combate en un interior estrecho (barra, billar, sótano) sin dañar el piso franco.'),
        ('Cuatro pisos vacíos', 'neones', 35, 'Jon recorre los pisos francos asaltados y reconstruye qué pasó con pistas (modo inspección). Todas las redadas siguen a los recados de los mensajeros.'),
        ('Ojos sobre el barrio', 'tower', 30, 'Tomar la Torre de la PDC: infiltración vertical, apagar el escáner y descubrir las actividades del barrio.'),
        ('La voz de Salaberri', 'estacion', 30, 'Pinchar una llamada de Salaberri: subir a un tren elevado en marcha y conectar el cable en el techo; combate sobre los vagones.'),
        ('Misa de medianoche', 'iglesia', 30, 'Los Acólitos se reúnen en San Roque. Jon se cuela en la cripta y oye que alguien vende datos de la resistencia a los dos bandos. Jefe: el Diácono, un Acólito con un poder que no es suyo.'),
        ('Recados', 'mercado', 30, 'Seguir a Pello sin que te vea por los tejados y el mercado. Jon le ve dejar un sobre a un agente de paisano.'),
        ('Pello', 'puente', 30, 'Frente a la barrera del puente, Pello confiesa: su hermana Ane está en el Estadio, al otro lado. Decisión: entregarlo o dejarlo huir. Salaberri llega y hay que escapar.'),
        ('La línea 0', 'sub', 30, 'Rosa y Jon roban el tranvía histórico de las cocheras. Contrarreloj por el barrio recargando la catenaria mientras la PDC corta la línea tramo a tramo.'),
        ('Sobrecarga', 'anchor', 35, 'Jon mete carga en el Ancla desde la catenaria mientras llegan cuatro oleadas (Blindados en la última). Cae la barrera. Mensaje de Salaberri en la cabina.'),
    ],
    side=[
        ('Las siete letras', 'Anselmo, proyeccionista', 'cine', 30, 'Encender A-S-C-E-N-S-O: cada letra se alimenta desde un sitio distinto del barrio. Premio: el noticiario del Proyecto Ascend.'),
        ('El tranvía fantasma', 'Rosa', 'sub', 25, 'Un tranvía circula de noche sin conductor. Los Acólitos lo usan para mover armas: subir en marcha y pararlo.'),
        ('Fianza', 'Txema', 'bar', 30, 'Sacar al sobrino de Txema de un furgón de la PDC antes de que cruce el control de la autovía.'),
        ('Campanas mudas', 'Don Julián, párroco', 'iglesia', 30, 'La PDC ha llenado el claustro de micrófonos. Quitarlos todos sin que el agente de la sacristía te vea.'),
        ('Escrituras', 'Benito, exdirector del Banco del Este', 'km0', 30, 'Escoltarle hasta su despacho a por las escrituras del barrio que la PDC quiere expropiar. La cámara acorazada se queda cerrada (Eco).'),
        ('Cables cruzados', 'Nekane, técnica de teléfonos', 'neones', 30, 'Reparar la red de cabinas del barrio. Abre la actividad de las cabinas.'),
        ('Neón', 'Maripaz, dueña del club Ondarra', 'neones', 25, 'Un Acólito cobra «protección» a los bares. Persecución por las azoteas y combate en un letrero gigante.'),
        ('Frío', 'Charo, pescadera', 'mercado', 30, 'Las cámaras frigoríficas del mercado esconden medicinas requisadas por la PDC. Robarlas y repartirlas en tres portales.'),
        ('Retratos', 'Itxaso, fotógrafa', 'estacion', 35, 'Fotografiar a ocho agentes de paisano de Salaberri a partir de pistas: un paraguas rojo, una cojera, un perro.'),
        ('La radio de la amama', 'Juana, vendedora de conservas', 'mercado', 35, 'Una mujer que vendía conservas con la abuela de Jon le reconoce. Recuperar la radio de la abuela de un almacén embargado. La radio capta la frecuencia de la Centralita.'),
    ],
    acts=[
        ('Bases acólitas', 'Oleadas', 5, 12, 'Campamentos fortificados en solares y naves. Tres rondas de Acólitos cada vez más duras; en la tercera llega su cabecilla con poder prestado. Si te alejas, la base se recupera.', ['iglesia', 'mercado', 'sub']),
        ('Línea 0', 'Conducción contrarreloj', 3, 10, 'Llevas el tranvía histórico por un recorrido. Mantén la carga disparando a las subestaciones de paso y despeja la vía por delante: coches, barricadas y Acólitos.', ['sub', 'km0']),
        ('Cabinas de la Centralita', 'Puzle de circuitos', 8, 6, 'Cada cabina está cortada. Sigue el cable por las fachadas y carga las cajas de empalme en orden: si cargas una antes de tiempo, salta el diferencial y vuelta a empezar.', ['km0', 'neones', 'bar']),
        ('Ojos de Salaberri', 'Sabotaje sigiloso', 6, 8, 'Grupos de 3 a 5 cámaras que se vigilan entre sí. Rómpelas sin que ninguna vea caer a otra; si una te ve, llama al dron sabueso.', []),
        ('Carreras de tejados', 'Carrera contra fantasma', 4, 6, 'Pello te reta por las azoteas: puntos de control, atajos por escaleras de incendios y cables de la catenaria, y el fantasma de su mejor tiempo.', ['neones', 'estacion']),
        ('Buzones muertos', 'Búsqueda por fotos', 6, 7, 'La resistencia esconde mensajes. Recibes una foto en blanco y negro de un rincón del barrio y tienes que encontrarlo sin marcador en el mapa.', []),
    ],
    events=[
        ('Redada', 'Una patrulla saca a los vecinos de un portal. Si intervienes baja el control; si no, se llevan a alguien.'),
        ('Cortocircuito', 'Un armario eléctrico revienta y la calle se queda a oscuras; los Acólitos aprovechan para robar.'),
        ('Tranvía sin frenos', 'Un tranvía baja la cuesta descontrolado: frénalo absorbiendo su carga.'),
        ('Llamada perdida', 'Suena una cabina cercana: la Centralita da un encargo de dos minutos.'),
    ],
)

# ---------------------------------------------------------------------------
P['industrial'] = dict(
    title='Turno de noche', genre='Drama obrero de huelga y sabotaje',
    tone='Sirenas de turno, chispas y escarcha. Una historia sobre el miedo a perder el trabajo frente a hacer lo correcto.',
    premise='Aceros del Río fabrica los escudos de los Blindados. La PDC tiene a los obreros en turnos de dieciséis horas y obliga a Unai, la Encarnación de la Temperatura, a templar el acero con su marca. Los obreros quieren ir a la huelga, pero el que para acaba en el Estadio. Jon llega con la resistencia para ayudarles a parar la producción.',
    villain=('Kepa Ortuzar, el capataz', 'Jefe de seguridad de Aceros del Río y exboxeador. El que pega. Al final se pone el prototipo de armadura Escudo Mk II. Por encima de él, Marisa Goñi, «la Directora», que firmó con la PDC para salvar la empresa y ya no sabe cómo salir.'),
    allies=[('Unai', 'Fundidor, Encarnación de la Temperatura. Mitad caliente, mitad fría. Lento al hablar, humor seco.'),
            ('Begoña', 'Delegada sindical, 60 años. Ha visto tres huelgas y perdido dos. Organiza a todos.'),
            ('Ibai', 'Aprendiz de 19 años. Quiere pelear ya y se mete en líos.')],
    twist='Unai se está muriendo: la PDC solo le deja usar el calor y el frío de su marca le congela por dentro. Si la huelga gana y deja de templar, se salva. En un horno apagado, Jon encuentra el primer altar acólito con sangre seca: alguien presta poder a los Acólitos con sangre.',
    ending='Huelga general en la orilla: todas las sirenas suenan a la vez. Jon sube a la Antorcha congelando el muro de fuego y rompe el Ancla. La Directora decide si entrega los planos de los escudos a la resistencia (punto débil de los Blindados en el resto del juego).',
    result='Jon ayudó a los obreros a ganar la huelga de Aceros del Río, salvó a Unai, copió la Temperatura y rompió el Ancla de la Antorcha.',
    places=[
        ('taberna', 'Taberna El Turno', (6700, 2700), 'Bar abierto 24 horas donde se cruzan los turnos; el tablón de la huelga y las mesas de la asamblea.'),
        ('gasom', 'Gasómetros', (6550, 2280), 'Tres cilindros de hierro vacíos convertidos en refugio de obreros: dentro, un pueblo de chabolas en espiral.'),
        ('frigos', 'Frigoríficos del Río', (6950, 2450), 'Cámaras a −25 °C, carne colgada, niebla fría y la Cámara 9 con muestras de marcas.'),
        ('termica', 'Central Térmica', (6600, 3050), 'Turbinas, sala de control y la chimenea de 120 m con el reto de escalada.'),
        ('acerias', 'Aceros del Río', (6800, 3480), 'La fábrica de escudos: nave de laminado, horno alto y filas de escudos colgando de grúas puente.'),
        ('refineria', 'Refinería', (6650, 3900), 'Bosque de tuberías a tres alturas y depósitos esféricos: el mejor sitio para patinar.'),
        ('antorcha', 'La Antorcha', (7000, 4150), 'La llama que nunca se apaga, dentro de un muro de fuego. Arriba, el Ancla.'),
        ('vias', 'Playa de vías', (6950, 4650), 'Vagones de mercancías, la locomotora 7 y una mesa giratoria.'),
        ('graneles', 'Terminal de graneles', (6900, 5040), 'Montañas de carbón y sal, cintas transportadoras y la bahía.'),
    ],
    story=[
        ('Cambio de turno', 'taberna', 25, 'Jon cruza la frontera con Begoña y llega en el cambio de turno. Sigilo entre cientos de obreros: si caminas como ellos, nadie te ve.'),
        ('Mitad y mitad', 'inc', 30, 'Jon conoce a Unai junto al horno. Unai no deja que le copie: la PDC castigaría a sus compañeros. Sacarle de la nave durante una inspección.'),
        ('Nidos', 'termica', 30, 'Quitar a los francotiradores de las chimeneas para que la asamblea pueda reunirse sin que la vean.'),
        ('Asamblea', 'gasom', 25, 'Defender la asamblea secreta en el gasómetro de una redada sin matar a nadie: si muere un agente, los obreros votan no.'),
        ('La torre de la refinería', 'tower', 30, 'Tomar la Torre de la PDC entre tuberías y vapor.'),
        ('El horno apagado', 'termica', 30, 'Los Acólitos roban escudos. Seguirles hasta un horno apagado: un altar con sangre seca. Jefa: la Forjadora, Acólita con fuego prestado.'),
        ('Cámara 9', 'frigos', 30, 'Kepa ha encerrado a obreros en los frigoríficos. Rescatarlos antes de la hipotermia y encontrar tubos con muestras de marcas. Unai deja que Jon le copie: Temperatura.'),
        ('Escudos rotos', 'vias', 30, 'Sabotear el tren de escudos: patinar sobre hielo por la playa de vías, desviar agujas y descarrilarlo con la locomotora 7.'),
        ('Kepa', 'acerias', 35, 'Kepa se pone el Escudo Mk II y toma a Begoña como rehén en la nave de laminado. Jefe: calentar y congelar de golpe para que el escudo se agriete.'),
        ('La Antorcha', 'anchor', 35, 'Huelga general. Jon congela el muro de fuego y sube patinando por la chimenea mientras llegan drones. Rompe el Ancla.'),
    ],
    side=[
        ('Hijos del turno', 'Ibai', 'taberna', 30, 'Ibai quiere pelear. Entrenarle en el patio de la taberna y pararle antes de que asalte solo un camión.'),
        ('Hielo para el barrio', 'Unai', 'frigos', 25, 'La farmacia no tiene frío para la insulina. Llevar bloques de hielo por la sombra antes de que se derritan.'),
        ('La locomotora 7', 'Josune, maquinista', 'vias', 30, 'Arrancar la locomotora con Energía y abrir el atajo de la playa de vías.'),
        ('El pueblo del gasómetro', 'Txaro', 'gasom', 30, 'Las chabolas no tienen calefacción. Encender las estufas comunales y echar a los ladrones de leña.'),
        ('Muestras', 'Dra. Zabala', 'frigos', 30, 'Las muestras de la Cámara 9: destruirlas o llevarlas a la resistencia. Decisión con consecuencias en El Centro.'),
        ('Vapor', 'Mantenimiento de la refinería', 'refineria', 30, 'Escapes de vapor junto a las casas. Puzle de válvulas con calor y frío.'),
        ('Carbón y sal', 'Los chavales de la terminal', 'graneles', 25, 'Unos chavales roban carbón y Kepa los persigue. Ayudarlos a huir por las cintas transportadoras.'),
        ('La hija de la Directora', 'Leire Goñi', 'acerias', 35, 'Leire quiere que su madre deje a la PDC. Conseguir pruebas de lo que hacen con los presos. Cambia el final del barrio.'),
        ('La cima', 'Nahia, escaladora urbana', 'termica', 30, 'Subir a las tres chimeneas más altas del barrio sin tocar el suelo entre una y otra.'),
        ('Turno 16', 'Andrés, obrero', 'taberna', 35, 'Un obrero que lleva tres semanas sin salir de la fábrica. Acompañarle a casa por la orilla, ver lo que ha cambiado y sobrevivir a una emboscada.'),
    ],
    acts=[
        ('Hornos desbocados', 'Equilibrio de temperatura', 4, 6, 'Tres hornos con su aguja de temperatura. Calienta los fríos y enfría los calientes a la vez mientras los saboteadores los descontrolan. Si uno explota, fallas.', ['acerias', 'termica']),
        ('Pista de tuberías', 'Carrera de patinaje', 4, 5, 'Patina sobre hielo por las tuberías elevadas de la refinería: anillos, saltos entre tuberías y propulsión con plataforma de hielo.', ['refineria']),
        ('Convoyes de escudos', 'Intercepción de vehículos', 5, 7, 'Camiones blindados cruzan el barrio con escolta. Congela las ruedas, revienta los motores y saca los escudos antes de la frontera.', []),
        ('Nidos de chimenea', 'Escalada bajo fuego', 6, 5, 'Un francotirador en lo alto de cada chimenea. Sube por la cara que no ve, con el vapor como cobertura, y quítale de en medio.', ['termica', 'refineria']),
        ('Cámaras frías', 'Rescate contrarreloj', 3, 8, 'Laberintos de carne colgada y puertas que solo se abren con calor. Cada rehén tiene su barra de hipotermia.', ['frigos']),
        ('Piquetes', 'Combate no letal', 4, 7, 'Protege un piquete de huelga ante cargas de la PDC. Solo vale aturdir y congelar: una muerte y los huelguistas se van.', ['acerias', 'gasom', 'taberna']),
    ],
    events=[
        ('Fuga de gas', 'Una tubería pierde y prende: congélala antes de que llegue al depósito.'),
        ('Sirena de turno', 'Cientos de obreros salen a la vez; entre ellos la PDC pierde tu rastro.'),
        ('Escudo perdido', 'Un camión pierde un escudo en una curva: recógelo antes que los Acólitos.'),
        ('Hombre al agua', 'Un obrero cae al río helado: sácalo y caliéntalo.'),
    ],
)

# ---------------------------------------------------------------------------
P['midtown'] = dict(
    title='En directo', genre='Sátira mediática y thriller de conspiración',
    tone='Neón, pantallas y ruido. Todo es espectáculo: la PDC gana la guerra en las pantallas antes que en la calle.',
    premise='Las pantallas de la Plaza emiten día y noche «El Escudo», el programa de la PDC presentado por Íñigo Valdés. Cada noche enseñan a un «marcado peligroso». Esta semana es Jon: le acusan de matar a su abuela con imágenes manipuladas de la tormenta. Amaia, la costurera, y su grupo de teatro planean colarse en el plató del Edificio Meridiano para emitir la verdad: el noticiario del Proyecto Ascend del Cine Ascenso.',
    villain=('Íñigo Valdés', 'Presentador de «El Escudo». Encantador, rápido y sin escrúpulos. Cree que el Escudo salva vidas y vive de la audiencia: si la pierde, la PDC le deja caer.'),
    allies=[('Amaia', 'Costurera, Encarnación del Hilo. Irónica, mandona, cose uniformes para la PDC de día y pancartas de noche.'),
            ('Kiko', 'Técnico de luces del Teatro Real. Pincha cualquier pantalla. Nervioso, habla rápido.'),
            ('Doña Pilar', 'Actriz retirada y dueña del Teatro Real. Teatral en todo, valiente de verdad.')],
    twist='La emisión pirata funciona, pero la PDC la convierte en un montaje en el que Jon ataca el plató. Un vídeo no cambia a la ciudad; lo que la cambia es ver a Jon con sus propios ojos. En el noticiario se ve de espaldas a una ingeniera: la Centralita.',
    ending='Jon sube La Aguja balanceándose de torre en torre mientras todas las pantallas le siguen (Kiko pincha las cámaras de la PDC). Rompe el Ancla en directo. Valdés, sin audiencia, se queda solo en el plató.',
    result='Jon emitió el noticiario del Proyecto Ascend, copió el Hilo de Amaia y rompió el Ancla de La Aguja en directo ante toda la ciudad.',
    places=[
        ('plaza', 'Plaza de las Pantallas', (4690, 3450), 'Pantallas de 40 m en seis fachadas: nunca es de noche. Multitudes, escenario y controles.'),
        ('aguja', 'La Aguja', (4840, 3320), 'Rascacielos de 240 m con las escaleras selladas. El Ancla corona la antena.'),
        ('central', 'Estación Central', (5150, 3030), 'Vestíbulo de mármol con bóveda, consigna, andén fantasma y el tren elevado entrando por arriba.'),
        ('granvia', 'Gran Vía', (4050, 3050), 'Avenida en diagonal: la mejor línea de balanceo de la ciudad, kilómetro y medio sin cortes.'),
        ('textil', 'Distrito Textil', (3950, 3720), 'Naves bajas con tendederos en las azoteas. El taller de Amaia.'),
        ('teatros', 'Teatros de la Gran Vía', (4300, 3220), 'Marquesinas, tramoya, sótano de maquinaria y la sala oculta de la resistencia.'),
        ('meridiano', 'Edificio Meridiano', (5400, 3800), 'La televisión de la PDC: plató, sala de control y helipuerto.'),
        ('obra', 'La Obra', (4650, 3900), 'Rascacielos a medio construir: plantas sin paredes, grúas y un ascensor de obra.'),
    ],
    story=[
        ('Prime time', 'plaza', 25, 'Jon llega a Midtown y ve su cara en todas las pantallas. Huida entre una multitud que le reconoce.'),
        ('Hilo y aguja', 'inc', 30, 'Amaia le enseña a balancearse por la Gran Vía antes de dejarse copiar: Hilo.'),
        ('Antenas', 'tower', 30, 'Tomar la Torre de la PDC, entre drones y antenas.'),
        ('Función de tarde', 'teatros', 30, 'Reunión con el grupo de Doña Pilar en plena función. Redada: escapar por la tramoya sin interrumpir la obra.'),
        ('Bobinas', 'central', 30, 'Las bobinas del noticiario están en la consigna de la Estación Central. Robarlas y pelear en los andenes.'),
        ('Ensayo general', 'obra', 30, 'Planear el golpe sobre una maqueta: entrar por el tejado, por los conductos o como público. La elección cambia la misión siguiente.'),
        ('Directo', 'meridiano', 35, 'El golpe: infiltrar el Meridiano durante la emisión y llegar a la sala de control.'),
        ('Mal montaje', 'plaza', 30, 'La PDC corta la señal y emite un montaje de Jon atacando el plató. Escapar de la multitud y de los drones sin herir a nadie.'),
        ('Valdés', 'granvia', 25, 'Persecución del coche de Valdés por la Gran Vía. Entrevista forzada en una azotea: amenazar o convencer.'),
        ('La Aguja', 'anchor', 35, 'Subir La Aguja balanceándose en directo, con drones y helicópteros. Romper el Ancla ante toda la ciudad.'),
    ],
    side=[
        ('El anuncio de neón', 'Tito, tienda de discos', 'plaza', 30, 'Encender el anuncio más grande de la plaza recargando sus transformadores en las azoteas.'),
        ('Andén fantasma', 'Ramón, vive en el metro', 'central', 30, 'Explorar el andén cerrado hace 40 años: expediente y una línea olvidada.'),
        ('Público', 'Agencia de casting', 'meridiano', 30, 'Colarse como público en «El Escudo» y robar el guion de la semana siguiente.'),
        ('Telar de plata', 'Amaia', 'textil', 30, 'Recoger cinco hilos de plata en tendederos altos para el telar: el balanceo llega más lejos.'),
        ('Ascensoristas', 'Sindicato de ascensoristas', 'obra', 25, 'Ascensores cortados con gente dentro: rescates en vertical.'),
        ('Viral', 'Nora, creadora de vídeos', 'granvia', 30, 'Grabar acrobacias de Jon para cambiar lo que la gente piensa de él.'),
        ('Pases', 'Un revendedor', 'teatros', 25, 'Desmontar una estafa de pases falsos para salir del barrio.'),
        ('El crítico', 'Doña Pilar', 'teatros', 30, 'La PDC va a detener a un crítico de teatro. Sacarle de casa antes de que llegue el furgón.'),
        ('Pancartas', 'Kiko', 'textil', 35, 'Colgar pancartas de la resistencia en seis rascacielos en una sola noche.'),
        ('El fantasma del Teatro Real', 'Leyenda del barrio', 'teatros', 35, 'Alguien vive en el sótano del teatro: un marcado escondido desde antes del Cierre que cuenta cómo era la ciudad antes de la PDC.'),
    ],
    acts=[
        ('Retos de balanceo', 'Contrarreloj por anillos', 5, 4, 'Anillos entre rascacielos. Medallas por tiempo y por no tocar el suelo.', ['granvia', 'plaza']),
        ('Pantallas del Escudo', 'Hackeo con ritmo', 8, 5, 'Engánchate a una pantalla y sigue el ritmo de los pulsos para pincharla mientras los drones intentan soltarte.', ['plaza', 'granvia']),
        ('Fotoperiodismo', 'Fotografía', 10, 4, 'Encuadra abusos de la PDC desde miradores. Puntuación por encuadre, distancia y que no te vean.', []),
        ('Drones correo', 'Persecución aérea', 6, 5, 'Drones con datos vuelan entre torres. Persíguelo balanceándote y atrápalo con el hilo antes de que llegue a su torre.', []),
        ('Entre bastidores', 'Sigilo social', 3, 10, 'Cuélate en un teatro durante la función: muévete con los tramoyistas, cámbiate de ropa y no pises el escenario iluminado.', ['teatros']),
        ('Encargos de Amaia', 'Mensajería frágil', 5, 5, 'Lleva pancartas a azoteas contra reloj. Si recibes daño o chocas fuerte, la carga se rompe.', ['textil']),
    ],
    events=[
        ('Cámara de «El Escudo»', 'Un equipo graba una detención: si la paras ante la cámara, baja el control.'),
        ('Ascensor atascado', 'Gente atrapada en un ascensor exterior a 100 m.'),
        ('Enjambre', 'Un enjambre de drones de reparto cae sobre la plaza.'),
        ('Concierto relámpago', 'Un músico toca en una azotea y la PDC lo quiere bajar.'),
    ],
)

# ---------------------------------------------------------------------------
P['parque'] = dict(
    title='Lo que crece', genre='Cuento oscuro de iniciación',
    tone='Tarde dorada que se cierra en bosque. Pocas balas y mucho silencio: el miedo de una niña convertido en paisaje.',
    premise='La marca de Lur despertó hace tres semanas, cuando la PDC se llevó a sus padres. Desde entonces el parque crece cada noche: raíces que levantan caminos, árboles donde ayer había praderas. Lur se esconde en el invernadero y no quiere ver a nadie. Los Acólitos la llaman «la Semilla» y quieren llevársela; la PDC quiere quemar el parque para sacarla.',
    villain=('La Jardinera', 'Líder de los Acólitos del bosque norte. Habla bajo y cuida de los suyos. Su poder prestado de Raíz se está pudriendo y le abre una herida que no cierra. Con ella, el teniente Olano y sus lanzallamas de la PDC.'),
    allies=[('Lur', '15 años, Encarnación de la Raíz. Arisca, dibuja en cuadernos y habla con las plantas.'),
            ('Patxi', 'Guarda del parque, 70 años. Se quedó a cuidar a los animales del zoo cuando todos se fueron.'),
            ('Dra. Sáez', 'Conservadora del Museo de Historia Natural. Práctica, cree en los datos.')],
    twist='El parque no crece por miedo: Lur esconde a cientos de vecinos. Las raíces han formado bajo el Castillo una red de cuevas donde viven los que huyeron de las redadas. Si la PDC quema el parque, mueren todos. Y la Jardinera no quiere a Lur para el maestro, sino salvarla de él: lo llama «el Donante» y dice que cobra en sangre.',
    ending='Lur rompe con raíces el hormigón del Castillo y libera el Ancla. Cae la barrera de Los Bloques. Lur se queda a cuidar el parque y a la gente de las cuevas.',
    result='Jon protegió a Lur y a los vecinos escondidos bajo el Castillo, copió la Raíz (con o sin permiso) y rompió el Ancla del Castillo. Oyó hablar del «Donante».',
    places=[
        ('entrada', 'Calle 60', (4700, 2740), 'La avenida de la frontera, levantada por raíces: coches atrapados en troncos.'),
        ('pradera', 'Gran Pradera', (4950, 2600), 'Césped abierto con la base de la PDC: tiendas, focos y camiones cisterna con lanzallamas.'),
        ('lago', 'Lago', (4380, 2430), 'Barcas de remo, puentes de piedra y la isla del templete.'),
        ('zoo', 'Zoo y Pajarera', (5100, 2480), 'Recintos vacíos, animales sueltos y la cúpula de la pajarera.'),
        ('castillo', 'Castillo del Mirador', (4700, 2200), 'Torre de piedra encofrada en hormigón por la PDC. Debajo, las cuevas de raíces.'),
        ('museo', 'Museo de Historia Natural', (5390, 2140), 'Esqueletos de dinosaurio, dioramas y la cripta.'),
        ('embalse', 'Embalse', (4790, 1960), 'Lámina de agua con pasarela y la casa de compuertas.'),
        ('invern', 'Invernadero', (4420, 1900), 'Palacio de cristal reventado por raíces; dentro, la selva de Lur.'),
        ('bosque', 'Bosque del norte', (4500, 1750), 'Pinos y niebla; el campamento acólito con tótems de raíces.'),
    ],
    story=[
        ('Calle 60', 'entrada', 25, 'Jon cruza la frontera: el parque se ha comido la avenida. La PDC vigila desde la pradera.'),
        ('El guarda', 'zoo', 30, 'Patxi necesita ayuda con los animales sueltos. Mientras, cuenta lo de la niña del invernadero.'),
        ('Cristal roto', 'invern', 30, 'Jon llega al invernadero y Lur le ataca con raíces. Combate sin herirla: esquivar y hablar. Lur huye.'),
        ('Torre del lago', 'tower', 30, 'Tomar la Torre de la PDC junto al lago.'),
        ('La Jardinera', 'bosque', 30, 'Los Acólitos capturan a Patxi. Infiltración en el campamento y primera conversación con la Jardinera.'),
        ('El cuaderno', 'museo', 30, 'Lur deja un cuaderno con dibujos que son pistas. Seguirlas por el parque hasta el museo, donde la PDC tiene un puesto.'),
        ('Bajo el castillo', 'castillo', 30, 'Las pistas llevan a las cuevas: cientos de vecinos escondidos.'),
        ('Fuego', 'pradera', 35, 'La PDC prende fuego al parque. Defender el invernadero junto a Lur. Si te has ganado su confianza, te deja copiarla; si no, puedes hacerlo sin permiso.'),
        ('Raíz podrida', 'embalse', 30, 'La Jardinera, traicionada por su poder, ataca. Jefa sobre plataformas de raíces en el embalse. Vencida, confiesa que el Donante cobra en sangre.'),
        ('El castillo', 'anchor', 30, 'Jon y Lur rompen el encofrado con Quiebra mientras la PDC asalta. Cae la barrera.'),
    ],
    side=[
        ('La osa y su cría', 'Patxi', 'zoo', 30, 'Guiar a una osa y su cría hasta su recinto sin hacerles daño.'),
        ('Isla del lago', 'Dra. Sáez', 'lago', 25, 'El templete de la isla guarda un expediente.'),
        ('Túnel de la transversal', 'Andoni, vecino', 'bosque', 30, 'El paso olvidado bajo la carretera hundida, ruta de contrabando de comida.'),
        ('Sala de los dinosaurios', 'Dra. Sáez', 'museo', 30, 'Sigilo en el museo cerrado para recuperar un fósil que la PDC quiere vender.'),
        ('Barcas', 'Juantxo, barquero', 'lago', 25, 'Cruzar el lago en barca con vecinos de las cuevas sin que los vean los focos.'),
        ('Porteros', 'Rufino, portero', 'museo', 30, 'Un portero de una torre de lujo esconde a la familia del vecino de abajo. Protegerlos en una inspección.'),
        ('Semillas', 'Lur', 'invern', 30, 'Plantar semillas en seis parterres de la ciudad para que Lur pueda «oír» la ciudad.'),
        ('Los padres de Lur', 'Lur', 'pradera', 35, 'Buscar en el archivo del puesto de la PDC adónde se llevaron a los padres de Lur: a La Roca.'),
        ('Los arrepentidos', 'Acólitos arrepentidos', 'bosque', 30, 'Escoltar fuera del bosque a cuatro Acólitos que quieren dejar el culto.'),
        ('Corredores', 'Club de corredores', 'entrada', 35, 'Proteger a un grupo que corre de noche por el parque con Acólitos al acecho.'),
    ],
    acts=[
        ('Puentes de raíces', 'Puzle de crecimiento', 8, 5, 'Haz crecer raíces de nodo en nodo para unir orillas y terrazas. Cada raíz crece en línea recta y se corta si cruza otra.', ['lago', 'embalse']),
        ('Rastros', 'Rastreo', 5, 7, 'Sigue huellas, ramas rotas y sangre de Acólitos por el bosque hasta su escondite. La marca hace brillar el rastro a oscuras.', ['bosque']),
        ('Fieras sueltas', 'Pastoreo', 3, 8, 'Lleva animales del zoo a su recinto sin hacerles daño: raíces como vallas y ruido para asustarlos.', ['zoo']),
        ('Lianas', 'Carrera vertical', 4, 4, 'Sube por la fachada del museo o un árbol gigante con Enredadera, de asidero en asidero, contra el reloj.', ['museo']),
        ('El laberinto de setos', 'Laberinto vivo', 3, 8, 'Las paredes de seto se mueven cada 30 s. Encuentra las tres llaves y la salida.', ['castillo']),
        ('Cortafuegos', 'Contención de incendio', 4, 8, 'La PDC prende una zona. El fuego avanza con el viento: levanta tierra con Quiebra y salva todos los árboles que puedas.', ['pradera']),
    ],
    events=[
        ('Polen', 'Una nube de esporas duerme a los guardias de la zona (y a ti, si no te cubres).'),
        ('Animal suelto', 'Un animal del zoo corre por una avenida.'),
        ('Lanzallamas', 'Una patrulla quema un parterre: para el fuego.'),
        ('Raíz nueva', 'El suelo se abre y aparece un camino a un sitio oculto con un expediente.'),
    ],
)

# ---------------------------------------------------------------------------
P['bloques'] = dict(
    title='La fuga', genre='Película de fugas carcelarias',
    tone='Noches sin luz, murmullos en los rellanos, planos dibujados en servilletas. Cada noche trasladan presos a La Roca: el reloj corre.',
    premise='El Estadio del Norte es ahora el centro de detención de marcados. En tres noches la PDC trasladará a todos los presos a La Roca. Gorka, contrabandista y antiguo preso del estadio, tiene un plan para sacar a cuarenta personas, entre ellas Ane, la hermana de Pello. Le falta alguien que se funda con las sombras.',
    villain=('Alcaide Ugarte', 'Director del centro de detención. Exmilitar obsesionado con que nadie se escape; lleva un escáner de marcas en el ojo. No sabe que su hija Irati ayuda a Gorka.'),
    allies=[('Gorka', 'Contrabandista, 40 años, Encarnación de la Sombra. Cínico, humor negro, leal a los suyos.'),
            ('La Dolo', 'Presidenta de la asociación de vecinos. Lo sabe todo de todos y esconde a medio barrio.'),
            ('Irati Ugarte', 'Hija del alcaide, 20 años. Lleva comida a los presos y odia lo que hace su padre.'),
            ('Ane', '14 años, hermana de Pello. Dentro del estadio.')],
    twist='Gorka se queda atrás para cerrar la puerta y la PDC se lo lleva a La Roca. Al romper el Ancla del estadio, el Destino reacciona: el Ancla es una marca viva. Jon ve a Iker encadenado en lo alto de la Torre del Centro. Las barreras son Iker.',
    ending='Los cuarenta salen por el túnel. Jon vuelve al campo vacío, rompe el Ancla y tiene la visión de Iker. Cae la barrera del Puente de la Ría. A partir de aquí las barreras parpadean cuando Jon se acerca.',
    result='Jon sacó a cuarenta presos del Estadio con Gorka (que acabó en La Roca), copió la Sombra y, al romper el Ancla, descubrió que las barreras son Iker.',
    places=[
        ('santaana', 'Proyectos de Santa Ana', (5200, 1180), 'Doce torres de ladrillo sobre césped, rellanos abiertos y pasarelas entre bloques.'),
        ('abastos', 'Mercado de Abastos', (4000, 1450), 'Nave de hierro y cristal; los puestos esconden la entrada a los túneles de Gorka.'),
        ('elevado', 'Bajo el elevado', (4600, 1100), 'La estructura de acero del tren elevado: un techo continuo de vigas para moverse a oscuras.'),
        ('estadio', 'Estadio del Norte', (4320, 950), 'Gradas convertidas en celdas, focos y el campo con el Ancla rodeada de escáneres.'),
        ('cocheras', 'Cocheras del Elevado', (5050, 700), 'Trenes aparcados, foso de mantenimiento y el taller.'),
        ('punta', 'Parque de la Punta', (4690, 470), 'Acantilado sobre la ría, faro y merenderos.'),
        ('cancha', 'Cancha nocturna', (4700, 1500), 'Pista de baloncesto con focos y gradas: torneos clandestinos.'),
        ('mural', 'Mural de la resistencia', (3900, 800), 'Una pared de 30 m pintada con el mapa de los túneles.'),
    ],
    story=[
        ('Rellano', 'santaana', 25, 'Jon llega durante un apagón. La Dolo le esconde y le enseña el barrio a oscuras.'),
        ('Gorka', 'abastos', 30, 'Prueba de Gorka: sacar mercancía de contrabando del mercado delante de una patrulla.'),
        ('La torre del bloque', 'tower', 30, 'Tomar la Torre de la PDC entre los bloques.'),
        ('Sombra', 'elevado', 30, 'Gorka deja que Jon le copie a cambio de ayuda: Sombra. Tutorial bajo el elevado: fundirse y atravesar escáneres.'),
        ('Planos', 'cocheras', 30, 'Robar los planos del estadio del taller de las cocheras. Seguir a Irati, que entra al estadio con comida.'),
        ('Noche 1: dentro', 'estadio', 30, 'Entrar al estadio como sombra, encontrar a Ane y a los cuarenta, y marcar las rutas.'),
        ('Irati', 'mural', 30, 'Irati descubre a Jon. Decidir si confiar en ella; si sí, da los turnos de guardia.'),
        ('Noche 2: el túnel', 'abastos', 30, 'Abrir el túnel desde el mercado hasta los vestuarios (túneles inundados y derrumbes) mientras Gorka distrae.'),
        ('Noche 3: la fuga', 'estadio', 35, 'La fuga: guiar a cuarenta presos por gradas y túnel. Jefe: Ugarte, cuyo escáner te saca de la sombra. Gorka se queda y lo capturan.'),
        ('El Ancla viva', 'anchor', 30, 'Jon vuelve al campo vacío y rompe el Ancla. Revelación: Iker encadenado en la Torre. Cae la barrera.'),
    ],
    side=[
        ('Azotea del bloque 9', 'Kuko, chaval de parkour', 'santaana', 30, 'Reto de parkour entre torres sin tocar el suelo.'),
        ('Vestuarios', 'Irati', 'estadio', 30, 'Las fichas de los detenidos: entre ellos, Martín, el vecino del pueblo de Jon. Sacar su ficha y avisar a su familia.'),
        ('Cancha nocturna', 'El Profe, árbitro', 'cancha', 30, 'Torneo clandestino de la resistencia.'),
        ('Luz para un barco', 'Farero de la Punta', 'punta', 25, 'Encender el faro a la hora exacta para que entre un barco de Gorka.'),
        ('Ascensores', 'La Dolo', 'santaana', 30, 'Vecinos en silla de ruedas sin ascensor por los apagones: arrancar con Energía los ascensores de cuatro bloques.'),
        ('Pintadas', 'Txuri, grafitera', 'mural', 25, 'Pintar murales en los sitios más altos del barrio. Abre la actividad de los muros.'),
        ('Radio pirata', 'DJ Larra', 'santaana', 30, 'Montar una radio en la azotea más alta y defenderla de una incursión.'),
        ('Los niños del toque', 'Madres del bloque 4', 'cancha', 30, 'Unos niños juegan a romper escáneres. Sacarlos antes de que la PDC los pille.'),
        ('Mensajes caros', 'Presos y familias', 'abastos', 35, 'Un prestamista cobra a las familias por llevar mensajes a los presos. Desmontar su negocio.'),
        ('Pello y Ane', 'Según tu decisión en el Distrito Cero', 'estadio', 35, 'Si dejaste huir a Pello, reunirle con Ane. Si lo entregaste, Ane te pide verle en el piso franco.'),
    ],
    acts=[
        ('Apagón', 'Sigilo total', 5, 6, 'Cruza un tramo del barrio con todas las farolas apagadas y patrullas con linternas. Si te ven, vuelves al principio.', []),
        ('Rutas de fuga', 'Escolta sigilosa', 4, 8, 'Saca a una familia de marcados de su bloque hasta los túneles. Ellos no pueden fundirse: abre camino apagando luces y usando dobles.', ['santaana']),
        ('Escáneres de portal', 'Infiltración en cadena', 10, 4, 'Cada portal tiene escáner, cámara y guardia. Entra fundido por la reja, sube por el hueco de la escalera y corta el escáner.', ['santaana']),
        ('Torneo de la cancha', 'Arena con reglas', 3, 8, 'Rondas de combate, cada una con su regla: solo cuerpo a cuerpo, sin poderes, a oscuras o contra el reloj.', ['cancha']),
        ('Muros', 'Grafiti en altura', 12, 3, 'Pinta murales de la resistencia en lo alto de los bloques y bajo el elevado. La PDC tapa uno cada noche si no proteges la zona.', []),
        ('Toque de queda', 'Supervivencia (cazado)', 4, 5, 'Suena la sirena y una escuadra con perros y focos te persigue tres minutos. Escóndete y aguanta sin pelear.', []),
    ],
    events=[
        ('Corte de luz', 'El barrio se queda a oscuras: la Sombra se recarga sola y los guardias van a ciegas.'),
        ('Traslado', 'Un furgón saca presos del estadio hacia el puente. Interceptarlo.'),
        ('Escáner portátil', 'Una patrulla escanea a los vecinos en la cola del mercado.'),
        ('Fiesta de portal', 'Música y vecinos en la calle; la PDC quiere disolverla.'),
    ],
)

# ---------------------------------------------------------------------------
P['colinas'] = dict(
    title='La última función', genre='Misterio de asesinato e intriga de salón',
    tone='Atardecer dorado, trajes de gala y copas de cristal. Todos mienten; el sonido dice la verdad.',
    premise='Tras ver a Iker, Jon necesita saber cómo funciona el Amplificador que lo encadena, y eso solo lo saben los mandos que viven en Las Colinas. La noche que llega, el coronel Iturbe aparece muerto en su palco del Teatro del Monte durante la función de Lucía. La PDC culpa a la resistencia y amenaza con represalias. Jon tiene dos días para encontrar al asesino.',
    villain=('Teniente coronel Amaya Elorza', 'Mano derecha de Narbaiza. Elegante, culta, coleccionista de discos. Mató a Iturbe porque quería frenar el proyecto de la Defensa, y lo hizo por orden de Narbaiza.'),
    allies=[('Lucía', 'Soprano, Encarnación del Eco. Orgullosa y ingenua al principio sobre la PDC; aprende rápido.'),
            ('Fermín', 'Mayordomo de los Iturbe. Chismoso, leal y con muy buena memoria.'),
            ('Inés Iturbe', 'La viuda. Fría, sospechosa perfecta. Quiere sacar a sus hijos del barrio.')],
    twist='Sospechosos: la viuda, el director del teatro, Elorza y la propia Lucía (su voz rompió una copa justo antes del disparo). La PDC graba la voz de Lucía para hacer resonar las Anclas: por eso las barreras zumban en su nota. Iturbe iba a contarlo. En la mansión de Narbaiza, su diario: la Marca de Sangre puede prestarse.',
    ending='Lucía canta en directo por la radio la nota que hace temblar todas las barreras. Con el Grito, Jon rompe la cúpula del observatorio y el Ancla. Elorza escapa al Centro o cae, según cómo acabe el duelo en las antenas.',
    result='Jon resolvió el asesinato del coronel Iturbe (Elorza, por orden de Narbaiza), copió el Eco de Lucía, leyó el diario de Narbaiza sobre la Marca de Sangre y rompió el Ancla del Observatorio.',
    places=[
        ('mirador', 'Mirador de la Ría', (2420, 1500), 'Vista de la Isla y la Cúpula; el club de oficiales y coches de lujo aparcados.'),
        ('curvas', 'Carretera de las Curvas', (1950, 1550), 'Serpentina entre villas con controles en cada curva.'),
        ('letras', 'Letras IBAIA', (2200, 1680), 'Cinco letras de 15 m en la ladera; la sexta, caída más abajo.'),
        ('teatro', 'Teatro del Monte', (1720, 2230), 'Anfiteatro entre pinos, camerinos y el palco del crimen.'),
        ('iturbe', 'Villa Iturbe', (1450, 1950), 'Casa del coronel muerto: jardín de esculturas y despacho cerrado.'),
        ('mansion', 'Mansión de Narbaiza', (1700, 1300), 'Villa vacía con piscina, archivo y caja fuerte.'),
        ('antenas', 'Antenas del Halcón', (2050, 1080), 'Mástiles de radio de 150 m que emiten la voz de Lucía.'),
        ('obs', 'Observatorio', (1250, 1500), 'Cúpula de cristal blindado y telescopio; bajo la roca, el Ancla.'),
        ('embalse', 'Embalse de las Colinas', (1000, 2280), 'Presa con cascada y pinares.'),
    ],
    story=[
        ('Telón', 'teatro', 30, 'Jon entra como camarero en la gala. Disparo en el palco durante el aria de Lucía. Caos: acusan a Jon y tiene que huir.'),
        ('Fermín', 'iturbe', 30, 'El mayordomo le esconde. Examinar la villa del muerto en modo investigación.'),
        ('Torre de las curvas', 'tower', 30, 'Tomar la Torre de la PDC.'),
        ('La soprano', 'teatro', 30, 'La PDC va a detener a Lucía. Jon la protege y ella deja que la copie a cambio de limpiar su nombre: Eco.'),
        ('Paredes que hablan', 'curvas', 30, 'Escuchar a través de las paredes de las villas con la Ecolocalización para descartar sospechosos.'),
        ('La sexta letra', 'letras', 25, 'Un chaval que pintaba la letra caída vio a alguien huir. Persecución ladera abajo.'),
        ('Cena de oficiales', 'mirador', 30, 'Infiltrarse en la cena del club. Interrogar a cuatro sospechosos oyendo sus latidos.'),
        ('El diario', 'mansion', 30, 'Robar el diario de Narbaiza: Marca de Sangre, el Amplificador y la orden a Elorza.'),
        ('Antenas', 'antenas', 30, 'Elorza intenta matar a Lucía. Duelo en lo alto de los mástiles contra Elorza y su dron de combate.'),
        ('Do de pecho', 'anchor', 35, 'Lucía canta en directo; Jon rompe la cúpula con el Grito y el Ancla con la nota.'),
    ],
    side=[
        ('La letra caída', 'Postal', 'letras', 25, 'Bajar a la sexta letra y hacer la postal.'),
        ('El ermitaño', 'Un Acólito retirado', 'embalse', 30, 'En su cueva cuenta el origen del poder prestado: se paga con sangre.'),
        ('Recados de servicio', 'Fermín', 'curvas', 30, 'Los trabajadores de las villas están vigilados. Sacar los mensajes de la resistencia escondidos en la colada.'),
        ('El telescopio', 'Dra. Uribe, astrónoma', 'obs', 30, 'Desde el telescopio se ve la Cúpula: marca en el mapa los secretos que faltan.'),
        ('Coche oficial', 'Un mecánico', 'mirador', 30, 'Robar el coche de un oficial y bajarlo al puerto sin que te paren.'),
        ('Grabación', 'Una corista', 'antenas', 25, 'Sabotear la grabación de la voz de Lucía en el estudio de radio.'),
        ('Vinilos', 'Lucía', 'mansion', 30, 'Recuperar seis discos de Lucía de cajas fuertes de mansiones.'),
        ('La viuda', 'Inés Iturbe', 'iturbe', 35, 'Escoltar a los hijos de Inés fuera del barrio por las curvas.'),
        ('Campanas', 'El campanero', 'curvas', 30, 'Reparar las campanas de la ermita.'),
        ('Fuego en el pinar', 'Bomberos voluntarios', 'embalse', 35, 'Un incendio en el pinar: evacuar villas y decidir a quién sacas primero.'),
    ],
    acts=[
        ('Escuchas', 'Espionaje y deducción', 3, 10, 'En una fiesta, escucha a través de las paredes y descubre cuál de los invitados es el contacto.', ['curvas', 'mirador']),
        ('Bajada supersónica', 'Carrera de descenso', 4, 4, 'Estampido carretera abajo contra coches de la PDC, con atajos por jardines rompiendo cristales.', ['curvas']),
        ('Frecuencias', 'Puzle de sonido', 5, 5, 'Antenas desafinadas: gira las parabólicas hasta que tres tonos suenen en armonía.', ['antenas']),
        ('Cajas fuertes', 'Robo por oído', 6, 5, 'Abre cajas fuertes oyendo el clic de cada rueda mientras la seguridad hace la ronda.', ['mansion', 'iturbe']),
        ('Combate a ciegas', 'Arena en la oscuridad', 3, 6, 'Bodegas sin luz con enemigos de camuflaje óptico: solo los ves con pulsos de Eco.', []),
        ('Ojos en el cielo', 'Caza por sonido', 8, 3, 'Drones espía camuflados entre los pinos: encuéntralos por el zumbido y derríbalos.', []),
    ],
    events=[
        ('Control en la curva', 'La PDC para un coche de trabajadores.'),
        ('Alarma', 'Salta la alarma de una mansión y la seguridad privada dispara a quien sea.'),
        ('Ensayo', 'Se oye cantar a Lucía y las barreras vibran.'),
        ('Accidente', 'Un coche de lujo se sale en una curva.'),
    ],
)

# ---------------------------------------------------------------------------
P['puerto'] = dict(
    title='Carga pesada', genre='Película de atracos en el muelle',
    tone='Mediodía gris, bocinas, óxido y contenedores de colores. Un plan de cinco pasos con un equipo que no se fía.',
    premise='Un carguero trae a Ibaia el Segundo Amplificador: la PDC quiere encadenar a otra Encarnación. Nerea, la gruista, sabe en qué contenedor llega. Jon reúne un equipo para robarlo antes de que salga del puerto: Nerea, Txomin, jefe de los estibadores, Ainhoa, inspectora de aduanas, y Zuri, un falsificador.',
    villain=('Capitán de puerto Aldama, «el Contable»', 'Lleva la aduana como una empresa: todo tiene precio, también las personas. No es violento: para eso tiene a los Blindados.'),
    allies=[('Nerea', 'Gruista, Encarnación de la Gravedad. Seria y perfeccionista. La PDC la chantajea con su hija.'),
            ('Txomin', 'Jefe de estibadores. Bromista y grande.'),
            ('Ainhoa', 'Inspectora de aduanas y doble agente. No dice para quién trabaja.'),
            ('Zuri', 'Falsificador, de la red de Gorka. Paranoico.')],
    twist='Aldama sabía lo del golpe. En el contenedor 0451, junto al Amplificador, hay fichas del Proyecto Ascend: la de la Dra. Edurne Lasa, la ingeniera que diseñó el Amplificador. Su voz, en una grabación, es la de la Centralita. Ainhoa trabaja para ella.',
    ending='Con la Gravedad, Jon levanta doce contenedores y rompe el Ancla del fondo de la pila. El Segundo Amplificador se hunde en la bahía o se lo queda la resistencia: la decisión cambia el asalto a la Torre.',
    result='Jon robó el Segundo Amplificador con el equipo de Nerea, copió la Gravedad, descubrió que la Centralita es la Dra. Lasa (creadora del Amplificador) y rompió el Ancla del Contenedor.',
    places=[
        ('aduana', 'Aduana', (2480, 3000), 'Edificio de 1920 con archivo, escáner de contenedores y la oficina de Aldama.'),
        ('vias', 'Playa de vías', (2120, 3800), 'Vagones, grúa de vía y el depósito de locomotoras.'),
        ('grua7', 'Grúa 7', (2950, 3700), 'La grúa más alta (60 m) y la mejor vista de la bahía.'),
        ('terminal', 'Terminal de Contenedores', (2700, 3900), 'Pilas de seis alturas, pasillos estrechos y carretillas pórtico.'),
        ('tunel', 'Túnel del Puerto', (2950, 3950), 'Túnel bajo la ría cerrado por la PDC; los contrabandistas usan los conductos de ventilación.'),
        ('bar', 'Bar del Estibador', (2250, 4100), 'Bar de muelle con rumores, contratos y el torneo de pulsos.'),
        ('almacenes', 'Almacenes', (2200, 4800), 'Naves de ladrillo con mercancía confiscada y subastas ilegales.'),
        ('dique', 'Dique seco', (2700, 5230), 'Un carguero abandonado de 200 m para explorar por dentro.'),
    ],
    story=[
        ('Sirena de niebla', 'bar', 25, 'Jon llega al puerto y busca el Bar del Estibador. Pelea con los matones de Aldama.'),
        ('La gruista', 'inc', 30, 'Nerea mueve contenedores con su marca bajo vigilancia. Liberar a los estibadores forzados entre pasillos de contenedores.'),
        ('Torre de la aduana', 'tower', 30, 'Tomar la Torre de la PDC.'),
        ('El falsificador', 'almacenes', 30, 'Reclutar a Zuri durante una subasta ilegal de objetos confiscados.'),
        ('Ainhoa', 'aduana', 30, 'Entrar en la aduana a por el manifiesto. Ainhoa te pilla y resulta ser doble agente.'),
        ('Gravedad', 'grua7', 30, 'Nerea deja que Jon la copie: Gravedad. Mover contenedores para preparar la ruta del golpe.'),
        ('Ensayo', 'vias', 30, 'Ensayar la fuga con un tren de mercancías, contrarreloj.'),
        ('El golpe', 'terminal', 35, 'Llega el carguero. Cambiar de pila el contenedor del Amplificador, burlar el escáner y a los Blindados.'),
        ('Contenedor 0451', 'dique', 30, 'Aldama lo sabía. Huida por dentro del carguero del dique: las fichas del Ascend revelan a la Centralita. Jefe: Blindado pesado.'),
        ('Doce alturas', 'anchor', 30, 'Levantar la pila de doce contenedores bajo fuego y romper el Ancla. Decidir qué hacer con el Amplificador.'),
    ],
    side=[
        ('Cabina de la grúa 7', 'Postal', 'grua7', 25, 'Subir a la cabina en lo alto de la grúa.'),
        ('El carguero', 'Una exploradora urbana', 'dique', 35, 'Explorar el carguero hasta la sala de máquinas.'),
        ('Pulsos', 'Clientes del bar', 'bar', 25, 'Torneo de pulsos con la Gravedad (sin pasarse).'),
        ('Lo confiscado', 'Una vecina', 'almacenes', 30, 'Recuperar las pertenencias de los detenidos y devolverlas.'),
        ('Ratas del túnel', 'Un contrabandista', 'tunel', 30, 'Abrir la ruta por los conductos del túnel: atajo a la Isla.'),
        ('Asamblea a bordo', 'Txomin', 'terminal', 30, 'Proteger una asamblea de estibadores en un barco.'),
        ('Minas en la dársena', 'Un pescador', 'dique', 25, 'Redes con minas de la PDC: sacarlas con la Gravedad.'),
        ('Grúa sin freno', 'Seguridad del puerto', 'grua7', 30, 'Una grúa se suelta con el viento: estabilizarla.'),
        ('Etiquetas', 'Zuri', 'terminal', 35, 'Cambiar las etiquetas de cinco pilas: las armas van al mar y la comida al barrio.'),
        ('La hija de Nerea', 'Nerea', 'almacenes', 35, 'La PDC vigila a la hija de Nerea en el colegio del puerto. Sacarla.'),
    ],
    acts=[
        ('Pilas', 'Puzle de físicas', 5, 6, 'Mueve contenedores para construir un camino hasta un punto alto o abrir un pasillo. Cada uno pesa distinto y las pilas se caen si las desequilibras.', ['terminal']),
        ('Grúas', 'Sabotaje en altura', 4, 5, 'Sube a una grúa mientras gira y suelta su carga sobre el puesto de la PDC.', ['terminal', 'grua7']),
        ('Blindados de la aduana', 'Jefe opcional', 3, 8, 'Blindados pesados con escudo: arráncaselo con la Gravedad y úsalo contra ellos.', ['aduana']),
        ('Lanzamientos', 'Golf de gravedad', 4, 4, 'Lánzate con saltos de Gravedad de un punto a otro y cae en la diana con el menor número de lanzamientos.', []),
        ('Estibadores', 'Liberación y escolta', 6, 6, 'Libera grupos de estibadores forzados y llévalos al barco de Txomin bajo fuego.', ['terminal', 'vias']),
        ('Alijos', 'Búsqueda y transporte', 5, 5, 'Encuentra alijos de la resistencia entre contenedores con pistas del bar y llévalos flotando al muelle.', []),
    ],
    events=[
        ('Contenedor suelto', 'Un contenedor cae sobre trabajadores: páralo en el aire.'),
        ('Subasta', 'La PDC subasta objetos de detenidos.'),
        ('Niebla', 'Niebla espesa: la PDC no ve y tú tampoco.'),
        ('Barco entrando', 'Durante dos minutos la vigilancia se va al muelle.'),
    ],
)

# ---------------------------------------------------------------------------
P['costa'] = dict(
    title='Mar de fondo', genre='Cine de catástrofe y misterio costero',
    tone='Viento, olas y feria de pintura saltada. Bajo la postal, algo que da miedo: el mar se está llevando a la gente.',
    premise='En La Costa desaparecen vecinos de noche. Dicen que se los lleva el mar. Itziar, la socorrista, sabe la verdad: lanchas de la PDC sacan a gente de la playa hacia La Roca. Y se acerca una galerna como la que mató a la abuela de Jon. Jon tiene que meterse en el mar.',
    villain=('Capitana Zubiri, «la Patrona»', 'Jefa de las lanchas de la PDC. Fue socorrista con Itziar; se conocen desde niñas. Cree que llevarse a los marcados al mar es más humano que lo que les hacen en tierra.'),
    allies=[('Itziar', 'Socorrista, Encarnación de la Marea. Dura, protectora y con humor.'),
            ('Aitona Félix', 'Dueño de la feria. Esconde gente entre las atracciones.'),
            ('La pandilla de la casa del árbol', 'Cuatro niños que lo ven todo desde los canales.')],
    twist='La galerna no es natural: la PDC sobrecarga la barrera para empujar el mar contra la playa y obligar a la gente a evacuar hacia sus autobuses. Zubiri ya no quiere seguir: si Jon la convence, ayudará en El Centro.',
    ending='En plena galerna Jon salva el paseo con olas contrarias, bucea hasta el pie del muelle de la feria y rompe el Ancla bajo el agua. La tormenta para. Jon se reconcilia con el mar que se llevó a su abuela.',
    result='Jon descubrió que las lanchas de la Patrona se llevaban a gente a La Roca, sobrevivió a la galerna provocada por la PDC, copió la Marea y rompió el Ancla del Muelle.',
    places=[
        ('paseo', 'Paseo Marítimo', (1000, 3000), 'Hoteles en primera línea, palmeras y el búnker de la playa.'),
        ('torre', 'Torre de socorristas', (965, 3280), 'Torre de madera roja, el escondite de Itziar.'),
        ('concha', 'Playa de la Concha', (1070, 3520), 'Arena, chiringuitos y el naufragio frente a la orilla.'),
        ('skate', 'Pista de la playa', (1250, 3900), 'Bowls y rampas junto a la arena, punto de reunión de los chavales.'),
        ('feria', 'Muelle de la Feria', (720, 4210), 'Noria, montaña rusa de madera y casetas. El Ancla bajo el muelle.'),
        ('canales', 'Canales', (1330, 4320), 'Casas de colores sobre canales, puentecillos y la casa del árbol.'),
        ('cueva', 'Cueva de los contrabandistas', (850, 5300), 'Solo se entra con marea baja.'),
        ('faro', 'Faro del Sur', (1760, 5790), 'Faro sobre las rocas; la linterna, cerrada hasta las Alas.'),
        ('puente', 'Puente de la Bahía', (2100, 5880), 'Control de la PDC en la entrada del puente.'),
    ],
    story=[
        ('Bandera roja', 'paseo', 25, 'Día de viento: la PDC cierra la playa. Un vecino desaparece en el agua delante de Jon.'),
        ('La socorrista', 'inc', 30, 'Itziar desconfía. Rescate juntos de unos niños arrastrados por la corriente.'),
        ('Torre del paseo', 'tower', 30, 'Tomar la Torre de la PDC.'),
        ('Los que se lleva el mar', 'canales', 30, 'Investigar casa por casa en los canales. La pandilla de la casa del árbol vio las lanchas.'),
        ('Marea', 'concha', 30, 'Itziar deja que Jon la copie: Marea. Surf, buceo y persecución de una lancha.'),
        ('La feria', 'feria', 30, 'Redada en la feria: combate sobre la noria y la montaña rusa en marcha.'),
        ('La cueva', 'cueva', 30, 'Con marea baja, entrar a la cueva donde la Patrona guarda a los detenidos y sacarlos antes de que suba el agua.'),
        ('La Patrona', 'puente', 30, 'Emboscada en el puente. Zubiri e Itziar cara a cara: convencerla o derrotarla (jefa en lancha con arpón).'),
        ('Galerna', 'paseo', 35, 'La galerna golpea: olas de ocho metros, coches flotando y rescates en el paseo.'),
        ('Bajo el muelle', 'anchor', 30, 'Bucear entre las olas hasta el pie del muelle y romper el Ancla. La tormenta para.'),
    ],
    side=[
        ('Cabina 13', 'Aitona Félix', 'feria', 25, 'Subir a la noria en marcha hasta la cabina 13.'),
        ('Club de la casa del árbol', 'La pandilla', 'canales', 30, 'Tres encargos de niños: el gato perdido, la «bruja» del faro y el tesoro del canal.'),
        ('El naufragio', 'Un buzo jubilado', 'concha', 30, 'Explorar el barco hundido frente a la playa.'),
        ('Protección', 'Dueña del chiringuito', 'concha', 25, 'La PDC le cobra «protección». Desmontar el negocio.'),
        ('Campeonato', 'Surfistas locales', 'skate', 30, 'Competición de surf para entrar en el grupo.'),
        ('Hotel Miramar', 'Recepcionista', 'paseo', 30, 'El hotel aloja oficiales. Robar la lista de detenidos para el traslado.'),
        ('La montaña rusa', 'Mecánico de la feria', 'feria', 30, 'Arreglar la montaña rusa con Energía y montarla para llegar a un sitio alto.'),
        ('Botellas', 'Itziar', 'cueva', 30, 'Ocho botellas con mensajes de presos de La Roca llegan a la costa.'),
        ('Itziar y la Patrona', 'Itziar', 'torre', 35, 'Fotos de infancia y una cita en el faro: ayudar a que hablen sin pelear.'),
        ('Amama', 'Jon', 'faro', 35, 'Jon sale a mar abierto en una barca como la de su abuela y le dice adiós.'),
    ],
    acts=[
        ('Olas', 'Surf con trucos', 4, 4, 'Surfea las olas grandes y encadena trucos. Puntos por estilo, altura y no caerte.', ['concha']),
        ('Socorrismo', 'Rescate en el agua', 6, 4, 'Bañistas arrastrados y lanchas de la PDC acercándose: llega surfeando y sácalos antes de que se hundan.', ['concha', 'paseo']),
        ('Casetas de la feria', 'Minijuegos de feria', 4, 4, 'Tiro con chorro, latas con olas y patos con burbujas. Puntuación por caseta y premios de feria.', ['feria']),
        ('Lanchas', 'Combate naval', 5, 6, 'Patrullas más allá de las olas: vuélcalas con olas y encierra a los tripulantes en burbujas.', []),
        ('Pecios', 'Buceo con aire limitado', 3, 8, 'Barcos hundidos con objetos en sus bodegas, bolsas de aire para respirar y corrientes que empujan.', ['concha']),
        ('Cuevas de marea', 'Puzle de nivel de agua', 3, 8, 'Sube y baja el agua con Marea alta para abrir pasos y hacer flotar plataformas hasta la salida.', ['cueva', 'faro']),
    ],
    events=[
        ('Corriente', 'Un bañista pide ayuda.'),
        ('Desembarco', 'Una lancha de la PDC desembarca para llevarse a alguien.'),
        ('Ola gigante', 'Una ola rompe sobre el paseo.'),
        ('Feria de noche', 'Música, multitud y carteristas.'),
    ],
)

# ---------------------------------------------------------------------------
P['chino'] = dict(
    title='Año del Fénix', genre='Saga familiar y persecución durante un festival',
    tone='Noche húmeda, vapor de cocinas, farolillos rojos y redes antivuelo. Tres generaciones de una familia y un festival que la PDC quiere prohibir.',
    premise='Llega el Festival de los Farolillos y la PDC lo ha prohibido por primera vez en ochenta años. Maite, mensajera y Encarnación de las Alas, se esconde entre las jaulas del mercado de los pájaros de su abuelo. La familia Chen-Etxeberria está dividida: la tía Lin preside la asociación de comerciantes y pactó con la PDC para salvar el barrio, a cambio de entregar a Maite.',
    villain=('El Hermano Mayor', 'Sumo sacerdote de los Acólitos en el barrio. Carismático; vende protección a los comerciantes. Su poder prestado es el más fuerte de la ciudad: viene directo del maestro.'),
    allies=[('Maite', 'Mensajera, Encarnación de las Alas. Rápida, irreverente, no sabe estarse quieta.'),
            ('Abuelo Chen', 'Lleva el Mercado de los Pájaros. Habla poco y con palomas mensajeras.'),
            ('Tía Lin', 'Presidenta de los comerciantes. Ha hecho cosas malas por buenas razones.'),
            ('Unax', 'Primo de Maite, cocinero del mercado nocturno.')],
    twist='El maestro de los Acólitos es Narbaiza. Presta su Marca de Sangre para que haya «terror marcado» y la ciudad pida más PDC: los Acólitos y la PDC son lo mismo. La tía Lin lo descubre y cambia de bando.',
    ending='El festival se celebra a pesar de la prohibición: miles de farolillos suben al cielo y tapan las redes. Jon vuela entre ellos hasta el Ancla, a 300 m sobre la Ciudad Amurallada. Cae la barrera del Centro: solo queda la Cúpula.',
    result='Jon ayudó a la familia de Maite a celebrar el festival, copió las Alas, descubrió que Narbaiza es el maestro de los Acólitos y rompió el Ancla del Cielo.',
    places=[
        ('lonja', 'Lonja del Pescado', (3560, 4800), 'Nave sobre pilotes en el agua: subastas de madrugada y barcas de pesca.'),
        ('gato', 'Azotea del gato de la suerte', (4100, 4300), 'Un gato dorado de seis metros sobre una azotea.'),
        ('amurallada', 'Ciudad Amurallada', (4520, 4700), 'Torres pegadas entre sí: pasillos sin sol, consultas de dentistas y azoteas a veinte alturas.'),
        ('cocinas', 'Callejón de las cocinas', (4820, 4480), 'Patios traseros con fogones, escaleras de servicio y montacargas de comida.'),
        ('nocturno', 'Mercado Nocturno', (5050, 4950), 'Puestos bajo toldos que tapan el cielo, vapor y neones verticales.'),
        ('pajaros', 'Mercado de los Pájaros', (5300, 4420), 'Calle de jaulas colgadas y palomares en las azoteas.'),
        ('teatro', 'Teatro de sombras', (5500, 4700), 'Teatro de marionetas con la historia de las marcas.'),
        ('templo', 'Templo del Dragón', (5600, 5100), 'Patio de incienso y el dragón de papel del festival.'),
    ],
    story=[
        ('Prohibido', 'lonja', 25, 'Jon llega por el puente y ve en la lonja cómo la PDC arranca farolillos.'),
        ('Palomas', 'pajaros', 30, 'Seguir una paloma del abuelo hasta Maite. Maite huye volando; Jon la persigue por los tejados.'),
        ('Torre del mercado', 'tower', 30, 'Tomar la Torre de la PDC.'),
        ('Redes', 'inc', 30, 'Maite cae en una red antivuelo. Rescatarla; ella deja que Jon la copie: Alas. Primer vuelo.'),
        ('Cena familiar', 'nocturno', 30, 'Cena tensa en el restaurante de la tía Lin. Redada en mitad de la cena: escapar por las cocinas.'),
        ('El Hermano Mayor', 'templo', 30, 'Infiltrarse en una ceremonia acólita en el templo. Primer duelo con el Hermano Mayor.'),
        ('Altar', 'amurallada', 30, 'El túnel de las tríadas lleva al altar en el corazón de la Ciudad Amurallada: viales de sangre con el sello de la PDC.'),
        ('Tía Lin', 'lonja', 30, 'Lin cambia de bando con las pruebas, pero el Hermano Mayor la secuestra. Persecución en la lonja y entre barcas.'),
        ('El festival', 'cocinas', 35, 'Los vecinos desafían la prohibición. Proteger el desfile del dragón y vencer al Hermano Mayor (jefe aéreo con sangre).'),
        ('Mil farolillos', 'anchor', 30, 'Volar entre farolillos y drones hasta el Ancla del cielo y romperla.'),
    ],
    side=[
        ('El gato de la suerte', 'Postal', 'gato', 25, 'Reto de parkour hasta el gato dorado.'),
        ('Marionetas', 'El titiritero', 'teatro', 30, 'Recuperar las marionetas robadas y ver la función de la historia de las marcas.'),
        ('El dentista', 'Dr. Ho', 'amurallada', 30, 'Un dentista esconde marcados. Protegerlos en una inspección piso a piso.'),
        ('El plato del festival', 'Unax', 'nocturno', 30, 'Encontrar los ingredientes del plato del festival por todo el barrio.'),
        ('Palomares', 'Abuelo Chen', 'pajaros', 30, 'Liberar palomares de las redes y recuperar las palomas.'),
        ('El dragón', 'Artesanos del festival', 'templo', 30, 'Encontrar las cinco piezas del dragón de papel escondidas en el barrio.'),
        ('Mahjong', 'Las vecinas del tercero', 'cocinas', 25, 'Ganar partidas para que te cuenten lo que saben.'),
        ('La pesca', 'Pescadera de la lonja', 'lonja', 30, 'La PDC confisca la pesca. Recuperar las barcas.'),
        ('La maestra Mei', 'Mei, artes marciales', 'templo', 35, 'Entrenamiento: técnicas nuevas de cuerpo a cuerpo.'),
        ('Carta a Iker', 'Jon', 'pajaros', 35, 'Jon manda una carta con una paloma hacia la Torre y la sigue volando hasta la Cúpula. La paloma vuelve con una pluma ámbar.'),
    ],
    acts=[
        ('Carreras del cielo', 'Vuelo por anillos', 5, 4, 'Anillos entre las torres más altas, con corrientes de aire que hay que aprovechar.', ['amurallada']),
        ('Redes antivuelo', 'Sabotaje bajo focos', 8, 4, 'Corta las redes sobre las azoteas sin que te pille el haz de los focos.', []),
        ('Palomas mensajeras', 'Seguimiento', 6, 5, 'Sigue a una paloma sin perderla ni acercarte demasiado (si se asusta, cambia de ruta) hasta un escondite.', ['pajaros']),
        ('Carteristas', 'Persecución a pie', 4, 4, 'Bajo los toldos no se vuela: persigue a un ladrón acólito entre puestos, cocinas y escaleras.', ['nocturno', 'cocinas']),
        ('Farolillos', 'Recolección aérea contrarreloj', 3, 6, 'Enciende cuarenta farolillos entre las torres antes de que acabe la canción del festival.', []),
        ('Duelos del templo', 'Duelo de jefe', 3, 7, 'Campeones acólitos con patrones propios (sangre, fuego y sombras prestadas) en el patio del templo.', ['templo']),
    ],
    events=[
        ('Redada en el mercado', 'La PDC vuelca puestos buscando a Maite.'),
        ('Paloma herida', 'Sigue su rastro hasta quien la hirió.'),
        ('Fuego en la cocina', 'Una cocina arde en un callejón cerrado.'),
        ('Ensayo del dragón', 'Los vecinos ensayan el desfile a escondidas.'),
    ],
)

# ---------------------------------------------------------------------------
P['centro'] = dict(
    title='La Torre', genre='Asalto final y película de asedio',
    tone='Tormenta sobre la Cúpula, cristal y piedra. Todo lo que Jon ha construido en nueve barrios entra en juego a la vez.',
    premise='Solo queda la Cúpula. Dentro, la Torre de la Defensa (520 m) y, en su cima, Iker encadenado al Amplificador. Narbaiza ha cerrado el Centro. Jon reúne a los aliados de los nueve barrios para un asalto en tres frentes: la bahía (La Roca), las calles y la Torre.',
    villain=('General Narbaiza', 'Marca de Sangre. Cree que las marcas son una enfermedad y que él es la cura: su sangre presta poder y quita voluntades. Le acompañan Salaberri y Elorza, si escapó.'),
    allies=[('La Centralita (Dra. Lasa)', 'Por fin en persona. Culpable y decidida a arreglarlo.'),
            ('Gorka', 'Preso en La Roca hasta que Jon le saca.'),
            ('Las Encarnaciones', 'Unai, Amaia, Lur, Lucía, Nerea, Itziar y Maite, cada una en su frente.'),
            ('Zubiri', 'Si Jon la convenció en La Costa, trae las lanchas.')],
    twist='La Dra. Lasa revela cómo apagar el Amplificador sin matar a Iker: llegar a la cima con todas las marcas. En lo alto, Iker no quiere que le liberen: Narbaiza le ha convencido de que, si suelta la Cúpula, la ciudad se hunde en el caos. Jon tiene que convencerle, no vencerle.',
    ending='Jon vence a Narbaiza en la cima. Iker deja que Jon le copie la Defensa y todas las barreras de la ciudad caen a la vez. Fin del acto.',
    result='Final del acto.',
    places=[
        ('calles', 'Calles viejas', (5000, 6200), 'Calles estrechas de piedra entre bancos antiguos, pasadizos y patios.'),
        ('bolsa', 'La Bolsa', (4300, 5500), 'Columnas, parqué de operaciones y la cámara acorazada.'),
        ('torre', 'Torre de la Defensa', (4720, 5770), '520 m de cristal. El Amplificador en la cima.'),
        ('archivo', 'Archivo de la Torre', (5300, 5900), 'Los cuatro objetos sin identificar del Proyecto Ascend.'),
        ('heli', 'Helipuerto de la PDC', (5800, 5640), 'Helicópteros de combate y el hangar.'),
        ('bateria', 'Parque de la Batería', (4690, 6720), 'Cañones antiguos, muralla y vistas a La Roca.'),
        ('ferris', 'Terminal de ferris', (4930, 6700), 'Ferris a La Roca y a la Península.'),
        ('roca', 'La Roca (prisión)', (4480, 7550), 'Prisión en una isla de la bahía: celdas, faro y muelle.'),
    ],
    story=[
        ('Bajo la Cúpula', 'calles', 30, 'Jon entra por la avenida del Barrio Chino. Calles vacías bajo toque de queda total.'),
        ('La Centralita', 'calles', 30, 'Jon conoce a la Dra. Lasa en un piso franco. Su confesión y el plan de los tres frentes. Perdonarla o no.'),
        ('Torre de la Batería', 'tower', 30, 'Tomar la Torre de la PDC.'),
        ('La Roca', 'roca', 35, 'Cruzar la bahía de noche con Itziar (y Zubiri) y liberar a Gorka, a los padres de Lur y a Martín.'),
        ('La cámara', 'bolsa', 30, 'La cámara de la Bolsa guarda las credenciales de Narbaiza. Atraco con varias marcas.'),
        ('Tres frentes', 'calles', 30, 'Los aliados atacan los puestos de mando. Jon cambia de frente según quién lo necesite.'),
        ('Helipuerto', 'heli', 30, 'Derribar los helicópteros que vigilan la Torre. Último encuentro con Salaberri.'),
        ('Ascensión', 'torre', 35, 'Subir 520 m por fuera de la Torre con todas las marcas: hilo, alas, gravedad, raíces.'),
        ('Narbaiza', 'torre', 30, 'Jefe final en tres fases: la Marca de Sangre roba tus marcas activas y controla a tus aliados.'),
        ('Iker', 'anchor', 20, 'Conversación con Iker encadenado. Convencerle. Copia de la Defensa: caen todas las barreras.'),
    ],
    side=[
        ('Los cuatro objetos', 'Dra. Lasa', 'archivo', 30, 'El archivo de la Torre: los cuatro objetos sin identificar del Proyecto Ascend.'),
        ('Celda 0', 'Gorka', 'roca', 25, 'La celda donde tuvieron a Iker antes de la Torre: lo que escribió en la pared.'),
        ('Banqueros', 'Un empleado de la Bolsa', 'bolsa', 30, 'Pruebas de quién financió el Cierre.'),
        ('Ferris', 'Capitán del ferri', 'ferris', 30, 'Evacuar civiles por la bahía.'),
        ('Pasadizos', 'Un cartero', 'calles', 30, 'Los túneles bajo las calles viejas, de banco en banco.'),
        ('Elorza', 'Lucía', 'bolsa', 35, 'Si Elorza escapó: encontrarla intentando huir y decidir qué hacer con ella.'),
        ('Salaberri', 'La Centralita', 'archivo', 30, 'Las grabaciones de Salaberri y la voz de Jon.'),
        ('Cuadros', 'Conservador del museo', 'calles', 25, 'Arte requisado por la PDC escondido en una sacristía.'),
        ('La víspera', 'Todos', 'bateria', 35, 'Antes del asalto, los aliados en el Parque de la Batería: una conversación con cada uno.'),
        ('Llamada a casa', 'Jon', 'ferris', 30, 'La última cabina llama al pueblo de Jon. Alguien contesta.'),
    ],
    acts=[
        ('Brechas', 'Defensa de posición', 4, 8, 'Coloca hexágonos de la Defensa como muros y aguanta oleadas que llegan por varias calles. Tras el final.', ['calles']),
        ('Cajas de seguridad', 'Atraco por salas', 5, 6, 'Cada sala pide una marca distinta: Sombra para los láseres, Temperatura para el cristal, Eco para la cerradura.', ['bolsa']),
        ('Helicópteros', 'Antiaéreo', 3, 6, 'Derriba helicópteros devolviéndoles sus misiles o lanzándoles objetos con la Gravedad.', ['heli']),
        ('Escaleras al cielo', 'Plataformas en el aire', 5, 4, 'Sube a la cima de un rascacielos solo con Peldaños de luz, con hexágonos limitados. Tras el final.', []),
        ('Puestos de mando', 'Conquista de zonas', 5, 6, 'Toma y mantén puestos de mando: cuanto más aguantas, más aliados llegan.', []),
        ('Ferris', 'Escolta naval', 3, 7, 'Protege un ferri de refugiados de lanchas y helicópteros con Cúpulas sobre la cubierta.', ['ferris']),
    ],
    events=[
        ('Propaganda', 'Helicópteros lanzan octavillas y altavoces anuncian recompensas.'),
        ('Aliado en apuros', 'Un aliado de otro barrio pide ayuda por radio.'),
        ('Tormenta eléctrica', 'Rayos sobre la Cúpula: la Energía se recarga sola.'),
        ('Fuga de La Roca', 'Presos huyen a nado por la bahía.'),
    ],
)

# ---------------------------------------------------------------------------
# Prompt para la IA de guiones

FORMAT = """FORMATO DE ENTREGA
1. Escaleta: una línea por misión con lo que cambia para Jon.
2. Guion de las 10 misiones de historia. Para cada una:
   - Escenas con cabecera (INT./EXT. – LUGAR – HORA) y acotaciones breves.
   - Diálogos con el formato del juego, el nombre en mayúsculas: JON: texto.
   - Objetivos en pantalla de 8 palabras como máximo.
   - Frases durante el juego (barks) para combate, sigilo, huida y espera: 6–10 por misión.
   - Frases de fallo y reintento: 3 por misión.
   - Cinemática de entrada y de salida: entre 1 y 3 minutos cada una.
3. Diálogos de las 10 misiones secundarias: presentación, durante y cierre.
4. Frases de ambiente: 20 de agentes de la PDC y 20 de vecinos del barrio, que cambien cuando el barrio queda liberado.
5. Textos de las 6 actividades: presentación, éxito y fallo.
6. Textos de los 4 sucesos.
7. Lista de decisiones y sus consecuencias, si las hay."""

STYLE = """ESTILO
- Castellano de España, natural y hablado. Frases cortas. Nada de discursos explicativos: lo que se pueda mostrar, se muestra.
- Jon tiene 17 años: humor seco cuando tiene miedo, culpa por la muerte de su abuela y por no haber protegido a Iker. No es un superhéroe; aprende en cada barrio.
- Cada personaje habla distinto (léxico, ritmo, muletillas). Nadie explica lo que el jugador ya sabe.
- Respeta el género y el tono del barrio: este barrio no se parece a ningún otro.
- No inventes marcas ni cambies el orden de las misiones, sus lugares o sus resultados. Puedes añadir escenas y personajes menores.
- Respeta la duración: unas 5 horas de historia y 5 de secundarias en total; cada misión de historia dura lo que indica."""


def prompt(key, order, B):
    d = P[key]
    b = B[key]
    i = order.index(key)
    prev = [f'- {B[k]["name"]}: {P[k]["result"]}' for k in order[:i]]
    inc = b['incarnation']
    lines = [
        f'Eres guionista de videojuegos de acción y mundo abierto. Escribe el guion completo del barrio {i + 1} de 10, «{b["name"]}», del juego ASCEND.',
        '',
        'EL JUEGO',
        PROLOGUE,
        CITY_RULES,
        '',
        'LO QUE YA HA PASADO EN LA CIUDAD' if prev else 'LO QUE YA HA PASADO EN LA CIUDAD\n- Nada: este es el primer barrio. Jon acaba de llegar a Ibaia.',
        *prev,
        '',
        f'EL BARRIO: {b["name"].upper()}',
        f'- Cómo es: {b["tagline"]} {b["look"]}',
        f'- Ambiente: {b["mood"]}',
        f'- Presencia de la PDC ({b["pdc"]}/5): {b["pdcText"]}',
        f'- Llegada: {b["arrive"]}',
        f'- Encarnación: {inc["name"] + ", " + inc["role"] + ". " if inc else ""}{b["incarnationText"]}',
        f'- Marca del barrio: {b["mark"]}. {b["anchor"]["name"]}: {b["anchor"]["text"]}',
        '',
        f'HISTORIA: «{d["title"]}» — {d["genre"]}',
        f'- Tono: {d["tone"]}',
        f'- Premisa: {d["premise"]}',
        f'- Antagonista: {d["villain"][0]}. {d["villain"][1]}',
        '- Personajes:',
        *[f'  · {n}: {t}' for n, t in d['allies']],
        f'- Giro: {d["twist"]}',
        f'- Final: {d["ending"]}',
        '',
        'LUGARES',
        *[f'- {n}: {t}' for k, n, at, t in d['places']],
        '',
        'MISIONES DE HISTORIA (≈5 h)',
        *[f'{n + 1}. «{t}» ({m} min) — {where(key, pl, B)}. {txt}' for n, (t, pl, m, txt) in enumerate(d['story'])],
        '',
        'MISIONES SECUNDARIAS (≈5 h)',
        *[f'S{n + 1}. «{t}» ({m} min, la da {g}) — {where(key, pl, B)}. {txt}' for n, (t, g, pl, m, txt) in enumerate(d['side'])],
        '',
        'ACTIVIDADES (repetibles; solo necesitan textos cortos)',
        *[f'- {n} ({ty}, {c} en el barrio): {txt}' for n, ty, c, mi, txt, near in d['acts']],
        '',
        'SUCESOS (aparecen al azar por las calles)',
        *[f'- {n}: {t}' for n, t in d['events']],
        '',
        STYLE,
        '',
        FORMAT,
    ]
    return '\n'.join(lines)


def where(key, pl, B):
    b = B[key]
    if pl == 'tower':
        return 'Torre de la PDC'
    if pl == 'anchor':
        return b['anchor']['name']
    if pl == 'inc':
        return f'donde vive {b["incarnation"]["name"]}' if b['incarnation'] else 'Ancla'
    if pl == 'entry':
        return 'frontera de entrada'
    for k, n, at, t in P[key]['places']:
        if k == pl:
            return n
    raise KeyError(f'{key}: lugar desconocido {pl}')
