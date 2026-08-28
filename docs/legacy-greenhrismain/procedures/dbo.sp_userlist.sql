
create PROCEDURE [dbo].[sp_userlist]
AS
BEGIN
    SET NOCOUNT ON;
SELECT        um.Username, um.userstatus, up.objectdesc, up.openobject, up.adddata, up.editdata, up.deletedata, tblorganization.organizationname
FROM            user_maintenance AS um INNER JOIN
                         User_permission AS up ON um.iduser = up.iduser INNER JOIN
                         userorganizationtbl ON um.iduser = userorganizationtbl.iduser INNER JOIN
                         tblorganization ON userorganizationtbl.idorganization = tblorganization.idorganization
ORDER BY um.Username, up.objectdesc
END
