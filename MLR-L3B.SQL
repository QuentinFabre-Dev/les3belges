-- -----------------------------------------------------------------------------
--             Génération d'une base de données pour
--                      Oracle Version 10g
--                        (28/11/2018 8:42:00)
-- -----------------------------------------------------------------------------
--      Nom de la base : MLR-L3B
--      Projet : 
--      Auteur : a
--      Date de dernière modification : 28/11/2018 8:41:37
-- -----------------------------------------------------------------------------

DROP TABLE TARIFS CASCADE CONSTRAINTS;

DROP TABLE COMMANDE CASCADE CONSTRAINTS;

DROP TABLE EXPEDITEUR CASCADE CONSTRAINTS;

DROP TABLE CLIENT CASCADE CONSTRAINTS;

DROP TABLE LIVRAISONS CASCADE CONSTRAINTS;

DROP TABLE PRODUIT CASCADE CONSTRAINTS;

DROP TABLE CATEGORIE CASCADE CONSTRAINTS;

DROP TABLE FACTURER CASCADE CONSTRAINTS;

DROP TABLE LIGNECOMMANDECLIENT CASCADE CONSTRAINTS;

-- -----------------------------------------------------------------------------
--       CREATION DE LA BASE 
-- -----------------------------------------------------------------------------

CREATE DATABASE MLR-L3B;

-- -----------------------------------------------------------------------------
--       TABLE : TARIFS
-- -----------------------------------------------------------------------------

CREATE TABLE TARIFS
   (
    IDTARIF NUMBER(2)  NOT NULL,
    POIDMAX NUMBER   NULL,
    PRIX NUMBER   NULL
,   CONSTRAINT PK_TARIFS PRIMARY KEY (IDTARIF)  
   ) ;

-- -----------------------------------------------------------------------------
--       TABLE : COMMANDE
-- -----------------------------------------------------------------------------

CREATE TABLE COMMANDE
   (
    NUMCOMMANDE CHAR(32)  NOT NULL,
    NUMCLIENT_COMMANDER CHAR(32)  NOT NULL,
    DATECOMMANDE CHAR(32)  NULL,
    MONTANTCOMMANDEHT CHAR(32)  NULL,
    STATUTCOMMANDE CHAR(32)  NULL,
    NUMCLIENT CHAR(32)  NULL
,   CONSTRAINT PK_COMMANDE PRIMARY KEY (NUMCOMMANDE)  
   ) ;

-- -----------------------------------------------------------------------------
--       INDEX DE LA TABLE COMMANDE
-- -----------------------------------------------------------------------------

CREATE  INDEX I_FK_COMMANDE_CLIENT
     ON COMMANDE (NUMCLIENT_COMMANDER ASC)
    ;

-- -----------------------------------------------------------------------------
--       TABLE : EXPEDITEUR
-- -----------------------------------------------------------------------------

CREATE TABLE EXPEDITEUR
   (
    IDEXP NUMBER(2)  NOT NULL,
    NOMEXP CHAR(255)  NULL
,   CONSTRAINT PK_EXPEDITEUR PRIMARY KEY (IDEXP)  
   ) ;

-- -----------------------------------------------------------------------------
--       TABLE : CLIENT
-- -----------------------------------------------------------------------------

CREATE TABLE CLIENT
   (
    NUMCLIENT CHAR(32)  NOT NULL,
    NOMCLIENT CHAR(32)  NULL,
    PRENOMCLIENT CHAR(32)  NULL,
    ADRESSE CHAR(32)  NULL,
    CP CHAR(32)  NULL,
    VILLE CHAR(32)  NULL,
    TELEPHONE CHAR(32)  NULL
,   CONSTRAINT PK_CLIENT PRIMARY KEY (NUMCLIENT)  
   ) ;

-- -----------------------------------------------------------------------------
--       TABLE : LIVRAISONS
-- -----------------------------------------------------------------------------

CREATE TABLE LIVRAISONS
   (
    IDCOMMANDE NUMBER(2)  NOT NULL,
    NUMCOMMANDE CHAR(32)  NOT NULL,
    IDEXP NUMBER(2)  NOT NULL,
    DATEEXPEDITION DATE  NULL,
    PRIXLIVRAISON NUMBER   NULL
,   CONSTRAINT PK_LIVRAISONS PRIMARY KEY (IDCOMMANDE)  
   ) ;

-- -----------------------------------------------------------------------------
--       INDEX DE LA TABLE LIVRAISONS
-- -----------------------------------------------------------------------------

CREATE  INDEX I_FK_LIVRAISONS_COMMANDE
     ON LIVRAISONS (NUMCOMMANDE ASC)
    ;

CREATE  INDEX I_FK_LIVRAISONS_EXPEDITEUR
     ON LIVRAISONS (IDEXP ASC)
    ;

-- -----------------------------------------------------------------------------
--       TABLE : PRODUIT
-- -----------------------------------------------------------------------------

CREATE TABLE PRODUIT
   (
    REFERENCEPROD CHAR(32)  NOT NULL,
    NUMCATEGORIE_DETENIR CHAR(32)  NOT NULL,
    LIBELLEPRODUIT CHAR(32)  NULL,
    PRIXUHT CHAR(32)  NULL,
    SEUILREAPRO CHAR(32)  NULL,
    DELAIREAPRO CHAR(32)  NULL,
    STOCKTEMP CHAR(32)  NULL,
    ORIGINEPRODUIT CHAR(32)  NULL,
    COULEURPRODUIT CHAR(32)  NULL,
    TAILLEPRODUIT CHAR(32)  NULL,
    STOCKTHEORIQUE CHAR(32)  NULL,
    NUMFOURNISSEUR CHAR(32)  NULL,
    NUMCATEGORIE CHAR(32)  NULL,
    POIDSPROD CHAR(32)  NULL
,   CONSTRAINT PK_PRODUIT PRIMARY KEY (REFERENCEPROD)  
   ) ;

-- -----------------------------------------------------------------------------
--       INDEX DE LA TABLE PRODUIT
-- -----------------------------------------------------------------------------

CREATE  INDEX I_FK_PRODUIT_CATEGORIE
     ON PRODUIT (NUMCATEGORIE_DETENIR ASC)
    ;

-- -----------------------------------------------------------------------------
--       TABLE : CATEGORIE
-- -----------------------------------------------------------------------------

CREATE TABLE CATEGORIE
   (
    NUMCATEGORIE CHAR(32)  NOT NULL,
    LIBELLECATEG CHAR(32)  NULL
,   CONSTRAINT PK_CATEGORIE PRIMARY KEY (NUMCATEGORIE)  
   ) ;

-- -----------------------------------------------------------------------------
--       TABLE : FACTURER
-- -----------------------------------------------------------------------------

CREATE TABLE FACTURER
   (
    IDEXP NUMBER(2)  NOT NULL,
    IDTARIF NUMBER(2)  NOT NULL,
    TARIFS CHAR(32)  NULL
,   CONSTRAINT PK_FACTURER PRIMARY KEY (IDEXP, IDTARIF)  
   ) ;

-- -----------------------------------------------------------------------------
--       INDEX DE LA TABLE FACTURER
-- -----------------------------------------------------------------------------

CREATE  INDEX I_FK_FACTURER_EXPEDITEUR
     ON FACTURER (IDEXP ASC)
    ;

CREATE  INDEX I_FK_FACTURER_TARIFS
     ON FACTURER (IDTARIF ASC)
    ;

-- -----------------------------------------------------------------------------
--       TABLE : LIGNECOMMANDECLIENT
-- -----------------------------------------------------------------------------

CREATE TABLE LIGNECOMMANDECLIENT
   (
    REFERENCEPROD CHAR(32)  NOT NULL,
    NUMCOMMANDE CHAR(32)  NOT NULL,
    QUANTITEPRODUIT CHAR(32)  NULL,
    PRIXVENTE CHAR(32)  NULL,
    CODERETOUR CHAR(32)  NULL,
    MOTIFRETOUR CHAR(32)  NULL
,   CONSTRAINT PK_LIGNECOMMANDECLIENT PRIMARY KEY (REFERENCEPROD, NUMCOMMANDE)  
   ) ;

-- -----------------------------------------------------------------------------
--       INDEX DE LA TABLE LIGNECOMMANDECLIENT
-- -----------------------------------------------------------------------------

CREATE  INDEX I_FK_LIGNECOMMANDECLIENT_PRODU
     ON LIGNECOMMANDECLIENT (REFERENCEPROD ASC)
    ;

CREATE  INDEX I_FK_LIGNECOMMANDECLIENT_COMMA
     ON LIGNECOMMANDECLIENT (NUMCOMMANDE ASC)
    ;


-- -----------------------------------------------------------------------------
--       CREATION DES REFERENCES DE TABLE
-- -----------------------------------------------------------------------------


ALTER TABLE COMMANDE ADD (
     CONSTRAINT FK_COMMANDE_CLIENT
          FOREIGN KEY (NUMCLIENT_COMMANDER)
               REFERENCES CLIENT (NUMCLIENT))   ;

ALTER TABLE LIVRAISONS ADD (
     CONSTRAINT FK_LIVRAISONS_COMMANDE
          FOREIGN KEY (NUMCOMMANDE)
               REFERENCES COMMANDE (NUMCOMMANDE))   ;

ALTER TABLE LIVRAISONS ADD (
     CONSTRAINT FK_LIVRAISONS_EXPEDITEUR
          FOREIGN KEY (IDEXP)
               REFERENCES EXPEDITEUR (IDEXP))   ;

ALTER TABLE PRODUIT ADD (
     CONSTRAINT FK_PRODUIT_CATEGORIE
          FOREIGN KEY (NUMCATEGORIE_DETENIR)
               REFERENCES CATEGORIE (NUMCATEGORIE))   ;

ALTER TABLE FACTURER ADD (
     CONSTRAINT FK_FACTURER_EXPEDITEUR
          FOREIGN KEY (IDEXP)
               REFERENCES EXPEDITEUR (IDEXP))   ;

ALTER TABLE FACTURER ADD (
     CONSTRAINT FK_FACTURER_TARIFS
          FOREIGN KEY (IDTARIF)
               REFERENCES TARIFS (IDTARIF))   ;

ALTER TABLE LIGNECOMMANDECLIENT ADD (
     CONSTRAINT FK_LIGNECOMMANDECLIENT_PRODUIT
          FOREIGN KEY (REFERENCEPROD)
               REFERENCES PRODUIT (REFERENCEPROD))   ;

ALTER TABLE LIGNECOMMANDECLIENT ADD (
     CONSTRAINT FK_LIGNECOMMANDECLIENT_COMMAND
          FOREIGN KEY (NUMCOMMANDE)
               REFERENCES COMMANDE (NUMCOMMANDE))   ;


-- -----------------------------------------------------------------------------
--                FIN DE GENERATION
-- -----------------------------------------------------------------------------