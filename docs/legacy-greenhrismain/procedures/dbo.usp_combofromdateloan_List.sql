create PROCEDURE [dbo].[usp_combofromdateloan_List] 
	-- Add the parameters for the stored procedure here
		@idclient integer
AS 
BEGIN
	 SET NOCOUNT ON --added to prevent extra result sets from
	-- interfering with SELECT statements.
SET NOCOUNT ON;

		CREATE TABLE #TempTableloanfromdate (
		 [ID] INT IDENTITY(1, 1) PRIMARY KEY,
		[idclient]int,
		datefrom date	  
		);

		CREATE INDEX idx_fromdate ON #TempTableloanfromdate (datefrom);	


	
IF @idclient >0 --means if client selected the combo box with value
	Begin
		--SELECT DISTINCT loanschedule.datefrom, loan.idclientloan
		--FROM            loanschedule INNER JOIN
       --                loan ON loanschedule.idloan = loan.idloan
		--					 where idclientloan = @idclient
		--		  		 ORDER BY CONVERT(DATE, loanschedule.datefrom, 101) DESC		 	
			
		INSERT INTO #TempTableloanfromdate (datefrom)
		--use view table here to summarize data
		SELECT DISTINCT datefrom
		FROM            View_datefromloan
		WHERE        (idclientloan = @idclient)

		select * from #TempTableloanfromdate order by datefrom
		DROP TABLE #TempTableloanfromdate;

	End;
		
else IF @idclient=0 or @idclient = '' 
	Begin
		--SELECT DISTINCT loanschedule.datefrom, loan.idclientloan
		--FROM            loanschedule INNER JOIN
        --                loan ON loanschedule.idloan = loan.idloan
		--				 ORDER BY CONVERT(DATE, loanschedule.datefrom, 101) DESC
		
		INSERT INTO #TempTableloanfromdate (datefrom)		
		SELECT    distinct datefrom
		FROM            View_datefromloan
		select * from #TempTableloanfromdate order by datefrom

	End;

END;