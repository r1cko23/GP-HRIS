create PROCEDURE [dbo].[usp_combocuttoff_Listenddate] 
	-- Add the parameters for the stored procedure here
		@idclient integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
SET NOCOUNT ON;
	
SELECT DISTINCT CONVERT(VARCHAR(10), Date_End, 120) AS date_end1, CONVERT(varchar(10), Date_End, 101) AS date_end2
FROM            payroll_summary
WHERE        (idclientp = @idclient)
ORDER BY date_end1 desc


END