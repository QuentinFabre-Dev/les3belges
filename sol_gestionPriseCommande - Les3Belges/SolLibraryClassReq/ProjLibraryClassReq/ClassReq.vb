
Imports Oracle.DataAccess.Client

Public Class ClassReq
    Private Req As String   ' contenu de la requête
    Private Nbl As Integer      ' nombre de lignes manipulées par la requête
    Private Mess As String
    Private Shared Conn As New OracleConnection
    Private Shared ConnOk As Boolean
    Public Sub New(ByVal UneReq As String) ' méthode à portée de classe
        ' constructeur 
        Req = UneReq
        Mess = UneReq
        Nbl = 0  ' a voir.................................................
    End Sub
    Public Shared Sub Connecter() 'établit la connexion
        Dim ChaineConn As String
        If ClassReq.RetConnOk = False Then
            ChaineConn = "Data Source=(DESCRIPTION="
            ChaineConn = ChaineConn & "(ADDRESS_LIST=(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT=1521)))"
            ChaineConn = ChaineConn & "(CONNECT_DATA=(SERVER=DEDICATED)(SERVICE_NAME=xe)));"
            ChaineConn = ChaineConn & "User Id=USERL3B2;Password=USERL3B2;"
            Conn.ConnectionString = ChaineConn
            'test de la connexion 
            Try
                Conn.Open()
                Conn.Close()
                ConnOk = True
            Catch
                MsgBox("Connexion à la base impossible")
                ConnOk = False
            End Try
        End If
    End Sub

    Public Shared Function RetConnOk() As Boolean
        Return ConnOk
    End Function
    Public Function RetNbl() As Integer
        Return Nbl
    End Function
    Public Function GetMess()
        Return Mess
    End Function
    Public Function ExecuteSelect() As DataTable
        ' Exécution d'une requête et retour d'un data set
        Dim Ds As New DataSet ' dataset associé à une requête select
        Dim Dt As New DataTable ' datatable associé à une requête select
        Dim Cmd As New OracleCommand
        Dim ObjDa As New OracleDataAdapter
        Conn.Open()
        Cmd.CommandText = Req
        Cmd.Connection = Conn
        ObjDa.SelectCommand = Cmd

        Try
            Nbl = ObjDa.Fill(Ds, "Liste") 'exécution de la requête
            Dt = Ds.Tables("Liste")
        Catch
            Mess = "erreur requete   " & Req
        End Try
        Conn.Close()
        Nbl = Dt.Rows.Count
        Return Dt
    End Function
    Public Function ExecuteIUD() As Integer
        ' Exécution d'une requête de type nonquery retour du nb de lignes
        Dim Cmd As New OracleCommand
        Cmd.CommandText = Req
        Try
            Cmd.Connection = Conn
            Conn.Open()
            Nbl = Cmd.ExecuteNonQuery()
            Conn.Close()
            Mess = "Exécution requete ok"
        Catch
            Mess = "erreur requete   " & Req
        End Try
        Return Nbl
    End Function
End Class
