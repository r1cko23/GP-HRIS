CREATE PROCEDURE [dbo].[usp_combocuttoff_Listenddate13th] 
	-- Add the parameters for the stored procedure here
		@idclient nvarchar(10)
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
SET NOCOUNT ON;
	
SELECT DISTINCT top 150 CONVERT(VARCHAR(10), Date_End, 120) AS date_end1, CONVERT(varchar(10), Date_End, 101) AS date_end2
FROM            payroll_summary
--WHERE        (idclientp = @idclient)
ORDER BY date_end1 desc


END