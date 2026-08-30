/* ============================================================
   split — teclear un importe

   Lo comparten el teclado de apuntar y el de confirmar un cobro, que son
   los dos sitios donde se escribe una cantidad de dinero.

   Antes esto se guardaba en céntimos y cada tecla entraba por la
   derecha: para poner 12 € había que teclear 1, 2, 0, 0 y por el camino
   se leía «0,01», «0,12», «1,20». Cuatro pulsaciones y tres cifras que
   no eran la que querías, cuando la inmensa mayoría de los gastos son
   redondos o casi.

   Ahora se escribe como se dice: los dígitos van al entero, y los
   decimales solo aparecen si tocas la coma. 12 € son dos teclas. Y
   12,50 € son «1 2 , 5 0», que es exactamente como se lee.

   Lo que se guarda es lo tecleado —"12", "12," o "12,5"—, no un número:
   hace falta distinguir «12» de «12,» para saber si la coma ya está
   puesta, y eso un número no lo puede contar.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S;

  var MAX_ENTEROS = 9;   /* mil millones de euros es bastante */
  var MAX_DECIMALES = 2;

  function partes(txt) {
    var t = String(txt == null ? "" : txt);
    var i = t.indexOf(",");
    return i < 0
      ? { ent: t, dec: null }              /* null = todavía no hay coma */
      : { ent: t.slice(0, i), dec: t.slice(i + 1) };
  }

  /* Una tecla del teclado numérico: un dígito, la coma o el borrado.
     Devuelve lo tecleado ya actualizado; si la tecla no cabe, lo deja
     como estaba en vez de inventarse nada. */
  function teclaImporte(txt, tecla) {
    var t = String(txt == null ? "" : txt);

    if (tecla === "del") return t.slice(0, -1);

    if (tecla === ",") {
      if (t.indexOf(",") >= 0) return t;   /* ya hay una */
      /* Empezar por la coma es querer decir «cero coma algo». */
      return t === "" ? "0," : t + ",";
    }

    if (!/^[0-9]$/.test(tecla)) return t;

    var p = partes(t);

    if (p.dec !== null) {
      if (p.dec.length >= MAX_DECIMALES) return t;
      return t + tecla;
    }

    /* Sin coma todavía: el dígito engorda el entero. Un cero suelto no
       se queda delante —«05» no es un importe—, pero sí se admite
       teclear 0 para luego poner la coma. */
    if (p.ent === "0") return tecla;
    if (p.ent.length >= MAX_ENTEROS) return t;
    return t + tecla;
  }

  /* Lo tecleado, en euros. */
  function valorImporte(txt) {
    var t = String(txt == null ? "" : txt).replace(",", ".");
    var v = parseFloat(t);
    if (!isFinite(v) || v < 0) return 0;
    return Math.round(v * 100) / 100;
  }

  /* Lo que se pinta mientras se teclea. Los decimales se enseñan tal
     como van escritos —«12,» y «12,5» son estados legítimos a medio
     teclear— y el entero se agrupa por miles, que es lo que hace legible
     un «1.240». */
  function textoImporte(txt) {
    var p = partes(String(txt == null ? "" : txt));
    var ent = p.ent === "" ? "0" : p.ent;
    var n = parseInt(ent, 10);
    var entero = isFinite(n) ? S.num0.format(n) : "0";
    return p.dec === null ? entero : entero + "," + p.dec;
  }

  /* Al revés: de un importe que ya existe a lo que habría que teclear
     para escribirlo. Se usa al editar un movimiento y al calcular un
     cobro por horas. Los redondos van sin coma, que es como se
     escribirían; el resto, con sus dos decimales. */
  function importeDesde(valor) {
    var v = Math.round((+valor || 0) * 100) / 100;
    if (v <= 0) return "";
    if (Math.round(v * 100) % 100 === 0) return String(Math.round(v));
    return v.toFixed(2).replace(".", ",");
  }

  /* --- lo que usan otros archivos --- */
  A.teclaImporte = teclaImporte;
  A.valorImporte = valorImporte;
  A.textoImporte = textoImporte;
  A.importeDesde = importeDesde;
})();
