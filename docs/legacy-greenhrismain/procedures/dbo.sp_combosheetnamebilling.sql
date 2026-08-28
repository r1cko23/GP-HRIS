create PROCEDURE [dbo].[sp_combosheetnamebilling] 
	-- Add the parameters for the stored procedure here
		@billingreference nvarchar(70)
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
SELECT distinct billingsheetname
FROM           BILLINGTABLE
where billingreference= @billingreference
order by billingsheetname
   
END
