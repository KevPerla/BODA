# Música de la invitación

Cuando alguien toca el sello de cera y el sobre se abre, empieza a sonar la
canción. El reproductor ya está programado — solo falta el archivo.

## Cómo agregarla

1. Consigue el archivo de **"Night Changes" – One Direction** en formato `.mp3`.
2. Renómbralo exactamente a `night-changes.mp3`.
3. Colócalo en la carpeta **`public/`** del proyecto:

```
public/night-changes.mp3
```

> **Cuidado con la doble extensión.** Windows esconde las extensiones conocidas,
> así que al renombrar un archivo que ya se llama `cancion.mp3` y escribir
> `night-changes.mp3`, queda guardado como `night-changes.mp3.mp3` y el sitio no
> lo encuentra. Para verlo: en el Explorador, pestaña **Vista → Extensiones de
> nombre de archivo**. El nombre correcto termina en un solo `.mp3`.

Listo. No hay que tocar código: la ruta ya está configurada en
`SONG_URL` dentro de [`src/routes/index.tsx`](../src/routes/index.tsx).

## Cómo se comporta

- **Arranca sola al abrir el sobre.** Los navegadores solo permiten reproducir
  audio si el usuario hizo algo primero; tocar el sello cuenta como ese gesto,
  así que la canción arranca desde ahí y no antes.
- **Entra suave.** El volumen sube de 0 a ~55% en unos 2 segundos en vez de
  empezar de golpe mientras se abre la solapa.
- **Se repite** mientras la persona siga leyendo la invitación.
- **Botón de silencio** abajo a la derecha, con tres barritas que se mueven
  cuando suena y se aplanan cuando está en silencio.
- **Si el archivo no existe**, la invitación funciona igual: no suena nada y el
  botón ni siquiera aparece.

## Si quieres otra canción

Cambia el nombre del archivo y actualiza `SONG_URL` en `src/routes/index.tsx`.

## Nota sobre derechos

La canción es material con derechos de autor de sus titulares. Para una
invitación privada que se comparte con los invitados normalmente no hay
problema, pero ten en cuenta que el archivo lo aportas tú: no viene incluido en
el proyecto.
