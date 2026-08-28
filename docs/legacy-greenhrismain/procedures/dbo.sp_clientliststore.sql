create PROCEDURE [dbo].[sp_clientliststore] 
	-- Add the parameters for the stored procedure here
	@idorganization integer,
	@idclient int

AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
SELECT      Department.Department_desc
FROM         client INNER JOIN
                    Department ON client.idclient = Department.idclient
WHERE        (client.tagdelete = N'N') AND (client.clientstatus = 'Active')	and department.idclient = @idclient
ORDER By Department_desc


END
